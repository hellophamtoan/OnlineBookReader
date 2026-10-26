import { STATUS_LABELS } from '../../config/admin';
import type { EntityStatus } from '../../types';

// Nhãn "Đang hoạt động" / "Ngừng hoạt động" dùng chung cho sách, thể loại, tác giả, NXB (và gói đọc ở UC008)
export default function EntityStatusBadge({ status }: { status: EntityStatus }) {
  return <span className={`status ${status === 'active' ? 'status--ok' : 'status--bad'}`}>{STATUS_LABELS[status]}</span>;
}
