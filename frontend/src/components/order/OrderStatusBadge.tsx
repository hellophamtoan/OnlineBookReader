import type { OrderStatus } from '../../types';
import { statusMeta } from '../../utils/order';

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const m = statusMeta(status);
  return <span className={`status status--${m.tone}`}>{m.label}</span>;
}
