import { ORDER_FLOW } from '../../config/orders';
import type { OrderStatus } from '../../types';
import { statusMeta } from '../../utils/order';

type StepState = 'done' | 'current' | 'todo' | 'bad';
interface Step {
  label: string;
  state: StepState;
}

// Chuỗi bước hiển thị theo luồng PENDING -> PREPARING -> SHIPPING -> DELIVERED (BR7).
// Hủy / giao thất bại là điểm kết thúc rẽ nhánh nên thay bước cuối bằng một bước màu đỏ.
const buildSteps = (status: OrderStatus): Step[] => {
  const label = (s: OrderStatus) => statusMeta(s).label;
  if (status === 'CANCELLED') return [{ label: label('PENDING'), state: 'done' }, { label: label('CANCELLED'), state: 'bad' }];
  if (status === 'FAILED') {
    return [...ORDER_FLOW.slice(0, 3).map((s): Step => ({ label: label(s), state: 'done' })), { label: label('FAILED'), state: 'bad' }];
  }
  const at = ORDER_FLOW.indexOf(status);
  return ORDER_FLOW.map((s, i): Step => ({
    label: label(s),
    state: status === 'DELIVERED' || i < at ? 'done' : i === at ? 'current' : 'todo',
  }));
};

export default function OrderTimeline({ status }: { status: OrderStatus }) {
  return (
    <ol className="timeline" aria-label="Tiến trình đơn hàng">
      {buildSteps(status).map((s) => (
        <li key={s.label} className={`timeline__step is-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          {s.label}
        </li>
      ))}
    </ol>
  );
}
