// UC009 — Chi tiết đơn + cập nhật trạng thái (PREPARING = xác nhận, khớp BE)
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { EmptyState, LoadingBlock } from '../../components/common/States';
import OrderTimeline from '../../components/order/OrderTimeline';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { orderAdminService } from '../../services/admin/orderadminservice';
import type { OrderStatus } from '../../types';
import { formatDateTime, formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';
import { statusMeta } from '../../utils/order';
import { ADMIN_ORDER_NEXT } from '../../utils/adminOrderStatus';

// [Trang] Admin > Chi tiết đơn (/admin/orders/:id): thông tin khách, sách, nút chuyển trạng thái (xác nhận, giao, đã giao, thất bại, hủy).
export default function AdminOrderDetailPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id >= 1;
  const detail = useAsync(
    () => (valid ? orderAdminService.get(id) : Promise.reject(new Error('ID không hợp lệ'))),
    [id],
  );
  useDocumentTitle(detail.data ? `Đơn #${detail.data.id}` : 'Chi tiết đơn');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<OrderStatus | null>(null);

  const apply = async (status: OrderStatus) => {
    setBusy(true);
    setError('');
    try {
      if (status === 'CANCELLED') await orderAdminService.cancel(id);
      else if (status === 'PREPARING' && detail.data?.status === 'PENDING') await orderAdminService.confirm(id);
      else await orderAdminService.updateStatus(id, status);
      setNotice(`Đã cập nhật → ${statusMeta(status).label}`);
      setConfirm(null);
      detail.reload();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading && !detail.data) {
    return <LoadingBlock label="Đang tải đơn..." />;
  }
  if (detail.error || !detail.data) {
    return (
      <EmptyState
        title="Không tìm thấy đơn"
        hint={toMessage(detail.error) || 'Đơn không tồn tại.'}
        action={
          <Link className="btn btn--ghost" to={ROUTES.ADMIN_ORDERS}>
            Về danh sách
          </Link>
        }
      />
    );
  }

  const o = detail.data;
  const meta = statusMeta(o.status);
  const nexts = ADMIN_ORDER_NEXT[o.status] ?? [];

  return (
    <>
      <AdminPageHeader
        title={`Đơn hàng #${o.id}`}
        subtitle={`${o.receiverName} · ${formatDateTime(o.createdAt)}`}
        crumbs={[
          { label: 'Tổng quan', to: ROUTES.ADMIN_HOME },
          { label: 'Đơn hàng', to: ROUTES.ADMIN_ORDERS },
          { label: 'Chi tiết đơn hàng' },
        ]}
      />

      <div className="page-back-row">
        <Link to={ROUTES.ADMIN_ORDERS} className="btn btn--ghost btn--sm page-back-row__btn">
          ← Danh sách đơn
        </Link>
      </div>

      {notice && (
        <div className="alert alert--success admin-alert" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert--error admin-alert" role="alert">
          {error}
        </div>
      )}

      <OrderTimeline status={o.status} />

      <div className="admin-form__row" style={{ marginBottom: 20, alignItems: 'stretch' }}>
        <section className="form-section" style={{ flex: 1 }}>
          <h2 className="form-section__title">Trạng thái</h2>
          <p>
            <span className={`tag tag--${meta.tone}`}>{meta.label}</span>
            <span className="field__hint" style={{ marginLeft: 12 }}>
              {o.paymentMethod} · {o.paymentStatus}
            </span>
          </p>
          <p className="field__hint">Cập nhật: {formatDateTime(o.updatedAt)}</p>
          {nexts.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {nexts.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`btn btn--sm ${s === 'CANCELLED' || s === 'FAILED' ? 'btn--ghost' : 'btn--primary'}`}
                  disabled={busy}
                  onClick={() => setConfirm(s)}
                >
                  → {statusMeta(s).label}
                </button>
              ))}
            </div>
          ) : (
            <p className="field__hint" style={{ marginTop: 8 }}>
              Đơn đã kết thúc — không đổi trạng thái thêm.
            </p>
          )}
        </section>
        <section className="form-section" style={{ flex: 1 }}>
          <h2 className="form-section__title">Khách & giao hàng</h2>
          <p>
            <b>{o.user?.fullName ?? o.userFullName}</b>
            <br />
            {o.user?.email ?? o.userEmail}
            {o.user?.phone ? ` · ${o.user.phone}` : ''}
          </p>
          <p>
            Nhận: <b>{o.receiverName}</b> · {o.receiverPhone}
            <br />
            {o.shippingAddress}
          </p>
          {o.note && <p className="field__hint">Ghi chú: {o.note}</p>}
        </section>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Sách</th>
              <th className="table__num">SL</th>
              <th className="table__num">Đơn giá</th>
              <th className="table__num">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={`${it.bookId}-${it.title}`}>
                <td>{it.title}</td>
                <td className="table__num">{it.quantity}</td>
                <td className="table__num">{formatPrice(it.unitPrice)}</td>
                <td className="table__num">{formatPrice(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="table__strong">
                Tổng
              </td>
              <td className="table__num table__strong">{formatPrice(o.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? `Chuyển sang «${statusMeta(confirm).label}»?` : ''}
        message={
          confirm === 'CANCELLED' || confirm === 'FAILED'
            ? 'Hoàn kho. Nếu đã thanh toán ví (PAID) sẽ hoàn ví và ghi REFUNDED.'
            : 'Xác nhận cập nhật trạng thái đơn hàng.'
        }
        confirmLabel="Xác nhận"
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={() => confirm && apply(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
