// UC010 — Chi tiết user + khóa/mở
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { EmptyState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { userAdminService } from '../../services/admin/useradminservice';
import { formatDate, formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';

export default function AdminUserDetailPage() {
  const id = Number(useParams().id);
  const valid = Number.isInteger(id) && id >= 1;
  const detail = useAsync(
    () => (valid ? userAdminService.get(id) : Promise.reject(new Error('ID không hợp lệ'))),
    [id],
  );
  useDocumentTitle(detail.data ? detail.data.fullName : 'Người dùng');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lockOpen, setLockOpen] = useState(false);

  const toggle = async () => {
    if (!detail.data) return;
    setBusy(true);
    setError('');
    try {
      if (detail.data.isActive) {
        await userAdminService.lock(id);
        setNotice('Đã khóa tài khoản');
      } else {
        await userAdminService.unlock(id);
        setNotice('Đã mở khóa tài khoản');
      }
      setLockOpen(false);
      detail.reload();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (detail.loading && !detail.data) return <LoadingBlock label="Đang tải..." />;
  if (!detail.data) {
    return (
      <EmptyState
        title="Không tìm thấy người dùng"
        action={
          <Link to={ROUTES.ADMIN_USERS} className="btn btn--ghost">
            Về danh sách
          </Link>
        }
      />
    );
  }

  const u = detail.data;

  return (
    <>
      <AdminPageHeader
        title={u.fullName}
        subtitle={`${u.email} · ${u.role}`}
        crumbs={[
          { label: 'Tổng quan', to: ROUTES.ADMIN_HOME },
          { label: 'Người dùng', to: ROUTES.ADMIN_USERS },
          { label: u.fullName },
        ]}
        actions={
          u.role === 'USER' ? (
            <button
              type="button"
              className={`btn ${u.isActive ? 'btn--ghost' : 'btn--primary'}`}
              disabled={busy}
              onClick={() => setLockOpen(true)}
            >
              {u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
            </button>
          ) : undefined
        }
      />

      <div className="page-back-row">
        <Link to={ROUTES.ADMIN_USERS} className="btn btn--ghost btn--sm page-back-row__btn">
          ← Danh sách
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

      <div className="admin-form__row" style={{ gap: 16 }}>
        <section className="form-section" style={{ flex: 1 }}>
          <h2 className="form-section__title">Thông tin</h2>
          <p>
            <span className="field__hint">Trạng thái</span>
            <br />
            <span className={`tag ${u.isActive ? 'tag--ok' : 'tag'}`}>{u.isActive ? 'Hoạt động' : 'Đã khóa'}</span>
          </p>
          <p>
            <span className="field__hint">Điện thoại</span>
            <br />
            {u.phone || '—'}
          </p>
          <p>
            <span className="field__hint">Địa chỉ</span>
            <br />
            {u.address || '—'}
          </p>
          <p>
            <span className="field__hint">Số dư ví</span>
            <br />
            <b>{formatPrice(u.walletBalance)}</b>
          </p>
        </section>
        <section className="form-section" style={{ flex: 1 }}>
          <h2 className="form-section__title">Gói đọc & đơn hàng</h2>
          {u.subscription ? (
            <p>
              Gói: {u.subscription.hasActiveSubscription ? 'Còn hiệu lực' : 'Không có'}
              {u.subscription.isLifetime ? ' (Trọn đời)' : ''}
              <br />
              {u.subscription.currentEndDate
                ? `Hết hạn: ${formatDate(u.subscription.currentEndDate)}`
                : u.subscription.isLifetime
                  ? 'Không hết hạn'
                  : ''}
            </p>
          ) : (
            <p className="field__hint">Không áp dụng (Admin)</p>
          )}
          <p>
            Số đơn: <b>{u.orderStats.totalOrders}</b>
            <br />
            Đã chi (đơn giao thành công): <b>{formatPrice(u.orderStats.totalSpent)}</b>
          </p>
          <p>
            <Link className="btn btn--ghost btn--sm" to={`${ROUTES.ADMIN_ORDERS}?q=${encodeURIComponent(u.email)}`}>
              Xem đơn của user
            </Link>
          </p>
        </section>
      </div>

      <ConfirmDialog
        open={lockOpen}
        title={u.isActive ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản?'}
        message={
          u.isActive
            ? 'User sẽ không đăng nhập được cho đến khi được mở khóa.'
            : 'Tài khoản có thể đăng nhập trở lại.'
        }
        confirmLabel={u.isActive ? 'Khóa' : 'Mở khóa'}
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={toggle}
        onCancel={() => setLockOpen(false)}
      />
    </>
  );
}
