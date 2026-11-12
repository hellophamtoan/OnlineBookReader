// config/orders.ts
// Nhãn + màu của trạng thái đơn hàng và hình thức thanh toán. Khớp enum ở mục 4 "Quy ước" của hợp đồng MNM.
// UC009 (quản trị đơn hàng) dùng lại đúng các hằng số này, không tự định nghĩa lại.
import type { OrderStatus, PaymentMethod } from '../types';

export type StatusTone = 'wait' | 'doing' | 'ok' | 'bad';

export const ORDER_STATUSES: { value: OrderStatus; label: string; tone: StatusTone }[] = [
  { value: 'PENDING', label: 'Chờ xác nhận', tone: 'wait' },
  { value: 'PREPARING', label: 'Đang chuẩn bị', tone: 'doing' },
  { value: 'SHIPPING', label: 'Đang giao', tone: 'doing' },
  { value: 'DELIVERED', label: 'Đã giao', tone: 'ok' },
  { value: 'FAILED', label: 'Giao thất bại', tone: 'bad' },
  { value: 'CANCELLED', label: 'Đã hủy', tone: 'bad' },
];

// Luồng "đi thẳng" dùng cho thanh theo dõi trạng thái (FAILED / CANCELLED là điểm kết thúc rẽ nhánh)
export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'PREPARING', 'SHIPPING', 'DELIVERED'];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: 'COD', label: 'Thanh toán khi nhận hàng (COD)', hint: 'Trả tiền mặt cho người giao hàng.' },
  { value: 'WALLET', label: 'Ví nội bộ', hint: 'Trừ trực tiếp vào số dư ví khi đặt hàng.' },
];
