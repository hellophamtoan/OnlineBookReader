// services/mocks/handlers/cart.ts
// Giả lập K01-K05 (giỏ hàng). Mọi API đều trả toàn bộ giỏ sau thao tác, đúng hợp đồng.
import { MESSAGES } from '../../../config/rules';
import { MockHttpError, toInt } from '../http';
import type { Route } from '../router';
import { findBook, getCartLines, getStock, saveCartLines } from '../shopdb';
import type { CartLine } from '../shopdb';
import { requireCustomer } from './guards';

const lineView = (l: CartLine) => {
  const b = findBook(l.bookId);
  const stock = b ? getStock(b) : 0;
  const unitPrice = b?.price ?? 0; // giá hiện tại của sách, không phải giá lúc thêm vào giỏ
  return {
    bookId: l.bookId,
    title: b?.title ?? 'Sách không còn tồn tại',
    coverImage: null as string | null,
    unitPrice,
    quantity: l.quantity,
    stockQuantity: stock,
    // D8: sách ngừng bán / hết hàng vẫn nằm trong giỏ nhưng available=false
    available: !!b && b.status === 'active' && b.hasPhysical && stock > 0,
    subtotal: unitPrice * l.quantity,
  };
};

export const cartView = (userId: number) => {
  const items = getCartLines(userId).map(lineView);
  return { items, totalAmount: items.reduce((s, i) => s + i.subtotal, 0) };
};

const validation = (field: string, message: string) => new MockHttpError(400, message, 'VALIDATION_ERROR', [{ field, message }]);
const outOfStock = () => new MockHttpError(400, MESSAGES.quantityInvalid, 'OUT_OF_STOCK');

const bookIdOf = (v: unknown) => {
  const id = toInt(v);
  if (!Number.isInteger(id) || id < 1) throw validation('bookId', 'Mã sách không hợp lệ');
  return id;
};
const quantityOf = (v: unknown) => {
  const q = toInt(v);
  if (!Number.isInteger(q) || q < 1) throw validation('quantity', MESSAGES.quantityInvalid);
  return q;
};

export const cartRoutes: Route[] = [
  // ===== K01 GET /cart =====
  {
    method: 'GET',
    path: '/cart',
    handler: ({ token }) => ({ message: 'Lấy giỏ hàng thành công', data: cartView(requireCustomer(token).id) }),
  },

  // ===== K02 POST /cart (cộng dồn số lượng) =====
  {
    method: 'POST',
    path: '/cart',
    handler: ({ token, body }) => {
      const user = requireCustomer(token);
      const b = (body ?? {}) as Record<string, unknown>;
      const bookId = bookIdOf(b.bookId);
      const quantity = quantityOf(b.quantity);

      const book = findBook(bookId);
      if (!book || book.status !== 'active') throw new MockHttpError(404, 'Sách không tồn tại', 'NOT_FOUND');
      if (!book.hasPhysical || book.price === null) throw validation('bookId', 'Sách này chỉ có bản e-book, không thể đặt mua');

      const lines = getCartLines(user.id);
      const current = lines.find((l) => l.bookId === bookId)?.quantity ?? 0;
      if (current + quantity > getStock(book)) throw outOfStock();

      saveCartLines(
        user.id,
        current ? lines.map((l) => (l.bookId === bookId ? { ...l, quantity: current + quantity } : l)) : [...lines, { bookId, quantity }]
      );
      return { message: 'Đã thêm vào giỏ hàng', data: cartView(user.id) };
    },
  },

  // ===== K03 PUT /cart/:bookId (đặt số lượng mới) =====
  {
    method: 'PUT',
    path: '/cart/:bookId',
    handler: ({ token, params, body }) => {
      const user = requireCustomer(token);
      const bookId = bookIdOf(params.bookId);
      const quantity = quantityOf(((body ?? {}) as Record<string, unknown>).quantity);

      const lines = getCartLines(user.id);
      if (!lines.some((l) => l.bookId === bookId)) throw new MockHttpError(404, 'Sách không có trong giỏ hàng', 'NOT_FOUND');
      const book = findBook(bookId);
      if (!book || quantity > getStock(book)) throw outOfStock();

      saveCartLines(user.id, lines.map((l) => (l.bookId === bookId ? { ...l, quantity } : l)));
      return { message: 'Đã cập nhật giỏ hàng', data: cartView(user.id) };
    },
  },

  // ===== K04 DELETE /cart/:bookId =====
  {
    method: 'DELETE',
    path: '/cart/:bookId',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = bookIdOf(params.bookId);
      const lines = getCartLines(user.id);
      if (!lines.some((l) => l.bookId === bookId)) throw new MockHttpError(404, 'Sách không có trong giỏ hàng', 'NOT_FOUND');
      saveCartLines(user.id, lines.filter((l) => l.bookId !== bookId));
      return { message: 'Đã xóa khỏi giỏ hàng', data: cartView(user.id) };
    },
  },

  // ===== K05 DELETE /cart =====
  {
    method: 'DELETE',
    path: '/cart',
    handler: ({ token }) => {
      const user = requireCustomer(token);
      saveCartLines(user.id, []);
      return { message: 'Đã làm rỗng giỏ hàng', data: cartView(user.id) };
    },
  },
];
