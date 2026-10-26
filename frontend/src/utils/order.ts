// utils/order.ts
// Suy ra thông tin hiển thị từ giỏ hàng / đơn hàng (UC004; UC009 quản trị đơn hàng dùng lại).
import { ORDER_STATUSES, PAYMENT_METHODS } from '../config/orders';
import type { Cart, CartItem, Order, OrderStatus, PaymentMethod } from '../types';

export const EMPTY_CART: Cart = { items: [], totalAmount: 0 };

export const statusMeta = (s: OrderStatus) => ORDER_STATUSES.find((x) => x.value === s) ?? ORDER_STATUSES[0];
export const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

// Chỉ đơn PENDING mới được người dùng hủy (O04, BR7)
export const canCancel = (o: Pick<Order, 'status'>) => o.status === 'PENDING';

// Tổng số cuốn trong giỏ (hiện ở huy hiệu trên Header)
export const cartCount = (c: Cart) => c.items.reduce((n, i) => n + i.quantity, 0);

// Vấn đề của một dòng giỏ hàng; null = ổn. FE chặn thanh toán khi còn dòng có vấn đề (K01 / D8).
export const lineProblem = (i: CartItem): string | null => {
  if (!i.available || i.stockQuantity <= 0) return 'Sách đã ngừng bán hoặc hết hàng';
  if (i.quantity > i.stockQuantity) return `Chỉ còn ${i.stockQuantity} cuốn trong kho`;
  return null;
};

export const cartProblems = (c: Cart) => c.items.filter((i) => lineProblem(i) !== null);
