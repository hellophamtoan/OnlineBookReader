import type { OrderStatus } from '../../types';
import { statusMeta } from '../../utils/order';

// [Giao diện] Nhãn màu trạng thái đơn (Chờ xác nhận, Đang giao, Đã giao...).
export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const m = statusMeta(status);
  return <span className={`status status--${m.tone}`}>{m.label}</span>;
}
