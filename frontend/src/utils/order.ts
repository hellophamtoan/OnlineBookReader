// utils/order.ts
// Suy ra thông tin hiển thị từ giỏ hàng / đơn hàng (UC004; UC009 quản trị đơn hàng dùng lại).
import { ORDER_STATUSES, PAYMENT_METHODS } from '../config/orders';
import type { Cart, CartItem, Order, OrderStatus, PaymentMethod } from '../types';

export const EMPTY_CART: Cart = { items: [], totalAmount: 0 };

// [Xử lý] Tên và màu hiển thị của từng trạng thái đơn.
export const statusMeta = (s: OrderStatus) => ORDER_STATUSES.find((x) => x.value === s) ?? ORDER_STATUSES[0];
// [Xử lý] Tên phương thức thanh toán.
export const paymentLabel = (m: PaymentMethod) => PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;

// [Xử lý] Đơn còn được hủy không (để hiện nút Hủy).
// Chỉ đơn PENDING mới được người dùng hủy (O04, BR7)
export const canCancel = (o: Pick<Order, 'status'>) => o.status === 'PENDING';

// [Xử lý] Tổng số sách trong giỏ (số trên biểu tượng giỏ).
// Số loại sách trong giỏ (hiện ở huy hiệu trên Header — không đếm theo số lượng từng dòng)
export const cartCount = (c: Cart) => c.items.length;

// [Xử lý] Cảnh báo một dòng giỏ (hết hàng, vượt tồn kho).
// Vấn đề của một dòng giỏ hàng; null = ổn. FE chặn thanh toán khi còn dòng có vấn đề (K01 / D8).
export const lineProblem = (i: CartItem): string | null => {
  if (i.statusReason === 'INACTIVE') return 'Ngừng hoạt động';
  if (i.statusReason === 'OUT_OF_STOCK') return 'Hết hàng';
  if (i.statusReason === 'NOT_PHYSICAL') return 'Chỉ có e-book — không mua giấy';
  if (!i.available || i.stockQuantity <= 0) return 'Hết hàng hoặc ngừng hoạt động';
  if (i.quantity > i.stockQuantity) return `Chỉ còn ${i.stockQuantity} cuốn trong kho`;
  return null;
};

// [Xử lý] Tổng hợp cảnh báo của giỏ hàng.
export const cartProblems = (c: Cart) => c.items.filter((i) => lineProblem(i) !== null);
