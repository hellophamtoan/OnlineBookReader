// services/mocks/handlers/orders.ts
// Giả lập O01-O04. O01 làm đúng thứ tự của hợp đồng: validate -> giỏ trống -> tồn kho -> số dư ví -> tạo đơn
// -> trừ tồn kho -> trừ ví + ghi giao dịch -> xóa giỏ. Lỗi ở bước nào thì KHÔNG thay đổi gì (giống ROLLBACK).
//
// Thử nhánh lỗi 7a trên trình duyệt (Console):
//   localStorage.setItem('mock_order_out_of_stock','1')   // O01 trả OUT_OF_STOCK dù còn hàng
//   localStorage.removeItem('mock_order_out_of_stock')
//   Tài khoản user2@bookstore.local có ví 0đ -> chọn thanh toán ví để thấy INSUFFICIENT_BALANCE.
import { ORDER_STATUSES } from '../../../config/orders';
import { MESSAGES, RULES } from '../../../config/rules';
import { MockHttpError, flag } from '../http';
import type { Route } from '../router';
import {
  addWalletTx, allOrders, findBook, getCartLines, getStock, getWallet, nextOrderId, publicOrder, saveCartLines, saveOrders,
  setStock, setWallet, toOrderItems,
} from '../shopdb';
import type { MockOrder } from '../shopdb';
import { requireCustomer } from './guards';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const notFound = () => new MockHttpError(404, 'Không tìm thấy đơn hàng', 'NOT_FOUND');
const validation = (message = 'Tham số không hợp lệ') => new MockHttpError(400, message, 'VALIDATION_ERROR');

const orderIdOf = (v: string) => {
  const id = Number(v);
  if (!Number.isInteger(id) || id < 1) throw validation('id không hợp lệ');
  return id;
};

// Đơn phải thuộc về người gọi, nếu không coi như không tồn tại (404)
const ownOrder = (userId: number, id: number) => {
  const order = allOrders().find((o: MockOrder) => o.id === id && o.userId === userId);
  if (!order) throw notFound();
  return order;
};

export const orderRoutes: Route[] = [
  // ===== O01 POST /orders =====
  {
    method: 'POST',
    path: '/orders',
    handler: ({ token, body }) => {
      const user = requireCustomer(token);
      const b = (body ?? {}) as Record<string, unknown>;
      const receiverName = str(b.receiverName).trim();
      const receiverPhone = str(b.receiverPhone).trim();
      const shippingAddress = str(b.shippingAddress).trim();
      const paymentMethod = str(b.paymentMethod);
      const note = str(b.note).trim();

      const errors: { field: string; message: string }[] = [];
      if (receiverName.length < RULES.RECEIVER_NAME_MIN || receiverName.length > RULES.RECEIVER_NAME_MAX) errors.push({ field: 'receiverName', message: MESSAGES.receiverName });
      if (!RULES.PHONE_REGEX.test(receiverPhone)) errors.push({ field: 'receiverPhone', message: MESSAGES.phoneInvalid });
      if (shippingAddress.length < RULES.ADDRESS_MIN || shippingAddress.length > RULES.ADDRESS_MAX) errors.push({ field: 'shippingAddress', message: MESSAGES.addressInvalid });
      if (paymentMethod !== 'COD' && paymentMethod !== 'WALLET') errors.push({ field: 'paymentMethod', message: MESSAGES.paymentRequired });
      if (note.length > RULES.NOTE_MAX) errors.push({ field: 'note', message: MESSAGES.noteTooLong });
      if (errors.length) throw new MockHttpError(400, errors[0].message, 'VALIDATION_ERROR', errors);

      const lines = getCartLines(user.id);
      if (lines.length === 0) throw new MockHttpError(400, 'Giỏ hàng đang trống', 'EMPTY_CART');

      // Tồn kho: sách ngừng bán / không bán bản giấy / không đủ số lượng -> OUT_OF_STOCK (D8)
      const bad = lines.filter((l) => {
        const book = findBook(l.bookId);
        return !book || book.status !== 'active' || !book.hasPhysical || getStock(book) < l.quantity;
      });
      if (flag('mock_order_out_of_stock') && bad.length === 0) bad.push(lines[0]);
      if (bad.length) {
        const titles = bad.map((l) => findBook(l.bookId)?.title ?? `#${l.bookId}`);
        throw new MockHttpError(
          400,
          `Sách đã hết hàng hoặc không đủ số lượng: ${titles.join(', ')}`,
          'OUT_OF_STOCK',
          bad.map((l, i) => ({ field: 'bookId', message: titles[i] }))
        );
      }

      const items = toOrderItems(lines); // chốt đơn giá tại thời điểm đặt
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      if (paymentMethod === 'WALLET' && getWallet(user) < total) {
        throw new MockHttpError(400, 'Số dư ví không đủ để thanh toán đơn hàng', 'INSUFFICIENT_BALANCE');
      }

      // --- Mọi kiểm tra đã qua: áp dụng thay đổi ---
      const now = new Date().toISOString();
      const order: MockOrder = {
        id: nextOrderId(), userId: user.id, status: 'PENDING', paymentMethod: paymentMethod as MockOrder['paymentMethod'],
        totalAmount: total, receiverName, receiverPhone, shippingAddress, note: note || null, createdAt: now, updatedAt: now, items,
      };
      lines.forEach((l) => setStock(l.bookId, getStock(findBook(l.bookId)!) - l.quantity));
      if (paymentMethod === 'WALLET') {
        setWallet(user.id, getWallet(user) - total);
        addWalletTx({ userId: user.id, type: 'PAY_ORDER', amount: -total, refType: 'ORDER', refId: order.id });
      }
      saveOrders([order, ...allOrders()]);
      saveCartLines(user.id, []);

      return { status: 201, message: 'Đặt hàng thành công', data: { order: publicOrder(order) } };
    },
  },

  // ===== O02 GET /orders/my ===== (khai báo TRƯỚC /orders/:id)
  {
    method: 'GET',
    path: '/orders/my',
    handler: ({ token, query }) => {
      const user = requireCustomer(token);
      const status = query.get('status');
      if (status !== null && status !== '' && !ORDER_STATUSES.some((s) => s.value === status)) throw validation('status không hợp lệ');
      const page = Number(query.get('page') ?? 1);
      const limit = Number(query.get('limit') ?? 12);
      if (!Number.isInteger(page) || page < 1) throw validation('page không hợp lệ');
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw validation('limit không hợp lệ');

      // Sửa đoạn trong route GET /orders/my (khoảng dòng 115-118):
      const mine = allOrders()
        .filter((o: MockOrder) => o.userId === user.id && (!status || o.status === status))
        .sort((a: MockOrder, b: MockOrder) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        
        const total = mine.length;
      return {
        message: 'Lấy danh sách đơn hàng thành công',
        data: {
          items: mine.slice((page - 1) * limit, page * limit).map(publicOrder),
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        },
      };
    },
  },

  // ===== O03 GET /orders/:id =====
  {
    method: 'GET',
    path: '/orders/:id',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      return { message: 'Lấy chi tiết đơn hàng thành công', data: { order: publicOrder(ownOrder(user.id, orderIdOf(params.id))) } };
    },
  },

  // ===== O04 PUT /orders/:id/cancel =====
  {
    method: 'PUT',
    path: '/orders/:id/cancel',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const order = ownOrder(user.id, orderIdOf(params.id));
      if (order.status !== 'PENDING') {
        throw new MockHttpError(400, 'Chỉ có thể hủy đơn đang chờ xác nhận', 'INVALID_STATUS_TRANSITION');
      }

      // Hoàn tồn kho; đã trả bằng ví thì hoàn ví + ghi REFUND (D4)
      order.items.forEach((i: any) => {
        const book = findBook(i.bookId);
        if (book) setStock(book.id, getStock(book) + i.quantity);
      });
      if (order.paymentMethod === 'WALLET') {
        setWallet(user.id, getWallet(user) + order.totalAmount);
        addWalletTx({ userId: user.id, type: 'REFUND', amount: order.totalAmount, refType: 'ORDER', refId: order.id });
      }
      const cancelled: MockOrder = { ...order, status: 'CANCELLED', updatedAt: new Date().toISOString() };
      saveOrders(allOrders().map((o: MockOrder) => (o.id === order.id ? cancelled : o)));

      return { message: 'Đã hủy đơn hàng', data: { order: publicOrder(cancelled) } };
    },
  },
];
