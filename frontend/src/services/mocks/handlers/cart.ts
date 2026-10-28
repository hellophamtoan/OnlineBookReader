// UC004 API-41..45 — giỏ hàng (mock độc lập BE)
import { MESSAGES } from '../../../config/rules';
import { MockHttpError, toInt } from '../http';
import type { Route } from '../router';
import { findBook, getCartLines, getStock, saveCartLines } from '../shopdb';
import type { CartLine } from '../shopdb';
import { requireCustomer } from './guards';

const lineView = (l: CartLine) => {
  const b = findBook(l.bookId);
  const stock = b ? getStock(b) : 0;
  const unitPrice = b?.price ?? 0;
  const inactive = !b || b.status !== 'active';
  const noPhysical = !!b && !b.hasPhysical;
  const outOfStock = stock < l.quantity || stock <= 0;
  let statusReason: 'OK' | 'OUT_OF_STOCK' | 'INACTIVE' | 'NOT_PHYSICAL' = 'OK';
  if (inactive) statusReason = 'INACTIVE';
  else if (noPhysical) statusReason = 'NOT_PHYSICAL';
  else if (outOfStock) statusReason = 'OUT_OF_STOCK';
  const available = statusReason === 'OK';
  return {
    bookId: l.bookId,
    title: b?.title ?? 'Sách không còn tồn tại',
    coverUrl: b?.coverUrl ?? null,
    coverImage: b?.coverUrl ?? null,
    unitPrice,
    quantity: l.quantity,
    stockQuantity: stock,
    available,
    statusReason,
    subtotal: available ? unitPrice * l.quantity : 0,
  };
};

export const cartView = (userId: number) => {
  const items = getCartLines(userId).map(lineView);
  const purchasable = items.filter((i) => i.available);
  const totalAmount = purchasable.reduce((s, i) => s + i.subtotal, 0);
  const canCheckout = items.length > 0 && items.every((i) => i.available);
  return { items, totalAmount, canCheckout };
};

const validation = (field: string, message: string) =>
  new MockHttpError(400, message, 'VALIDATION_ERROR', [{ field, message }]);
const outOfStock = (msg = 'Số lượng vượt quá tồn kho') => new MockHttpError(409, msg, 'OUT_OF_STOCK');

const bookIdOf = (v: unknown) => {
  const id = toInt(v);
  if (!Number.isInteger(id) || id < 1) throw validation('bookId', 'Mã sách không hợp lệ');
  return id;
};
const quantityOf = (v: unknown) => {
  const q = toInt(v);
  if (!Number.isInteger(q) || q < 1 || q > 99) throw validation('quantity', MESSAGES.quantityInvalid);
  return q;
};

export const cartRoutes: Route[] = [
  {
    method: 'GET',
    path: '/cart',
    handler: ({ token }) => ({ message: 'Lấy giỏ hàng thành công', data: cartView(requireCustomer(token).id) }),
  },
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
      if (!book.hasPhysical || book.price === null)
        throw validation('bookId', 'Sách này chỉ có bản e-book, không thể đặt mua');
      const lines = getCartLines(user.id);
      const current = lines.find((l) => l.bookId === bookId)?.quantity ?? 0;
      if (current + quantity > getStock(book)) throw outOfStock();
      saveCartLines(
        user.id,
        current
          ? lines.map((l) => (l.bookId === bookId ? { ...l, quantity: current + quantity } : l))
          : [...lines, { bookId, quantity }],
      );
      return { message: 'Đã thêm vào giỏ hàng', data: cartView(user.id) };
    },
  },
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
      saveCartLines(
        user.id,
        lines.map((l) => (l.bookId === bookId ? { ...l, quantity } : l)),
      );
      return { message: 'Đã cập nhật giỏ hàng', data: cartView(user.id) };
    },
  },
  {
    method: 'DELETE',
    path: '/cart/:bookId',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = bookIdOf(params.bookId);
      const lines = getCartLines(user.id);
      if (!lines.some((l) => l.bookId === bookId)) throw new MockHttpError(404, 'Sách không có trong giỏ hàng', 'NOT_FOUND');
      saveCartLines(
        user.id,
        lines.filter((l) => l.bookId !== bookId),
      );
      return { message: 'Đã xóa khỏi giỏ hàng', data: cartView(user.id) };
    },
  },
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
