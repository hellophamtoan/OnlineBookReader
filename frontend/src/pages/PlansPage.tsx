// UC005 — Trang gói đọc: xem gói, xác nhận hạn, mua (trừ ví) / nhận free 1 lần
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../components/common/States';
import { ROUTES } from '../config/routes';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { planService, type ReadingPlan } from '../services/planservice';
import { formatPrice } from '../utils/format';
import { toMessage } from '../utils/errors';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}

export default function PlansPage() {
  useDocumentTitle('Gói đọc');
  const { user } = useAuth();
  const navigate = useNavigate();
  const plans = useAsync(() => planService.list(), []);
  const me = useAsync(
    () => (user?.role === 'USER' ? planService.me() : Promise.resolve(null)),
    [user?.id, user?.role],
  );
  const [picked, setPicked] = useState<ReadingPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Admin quản lý gói ở /admin/plans — không hiện UI đăng ký kiểu người dùng
  if (user?.role === 'ADMIN') {
    return <Navigate to={ROUTES.ADMIN_PLANS} replace />;
  }

  const reload = () => {
    plans.reload();
    me.reload();
  };

  const confirmBuy = async () => {
    if (!picked) return;
    if (!user) {
      setError('Vui lòng đăng nhập để đăng ký gói');
      setPicked(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await planService.subscribe(picked.id);
      setNotice(
        `Đã đăng ký «${result.subscription.planName}». Hạn đọc đến ${formatDate(result.currentEndDate)}.`,
      );
      setPicked(null);
      reload();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (plans.loading && !plans.data) {
    return (
      <div className="container page">
        <LoadingBlock label="Đang tải gói đọc..." />
      </div>
    );
  }
  if (plans.error) {
    return (
      <div className="container page">
        <ErrorState message={toMessage(plans.error)} onRetry={reload} />
      </div>
    );
  }

  const items = plans.data ?? [];
  const currentEnd = me.data?.currentEndDate ?? null;
  const hasSub = me.data?.hasActiveSubscription;
  const freeUsed = !!me.data?.freePlanUsed;

  return (
    <div className="container page">
      <h1 className="page__title">Gói đọc e-book</h1>
      <p className="field__hint" style={{ marginBottom: 16 }}>
        Đăng ký gói để mở các chương cần quyền đọc. Thanh toán bằng số dư ví
        {me.data?.walletBalance != null ? ` (hiện có ${formatPrice(me.data.walletBalance)})` : ''}.
      </p>

      {!user && (
        <div className="alert" role="status" style={{ marginBottom: 16 }}>
          Bạn chưa đăng nhập.{' '}
          <Link to={ROUTES.LOGIN}>Đăng nhập</Link> để đăng ký gói đọc.
        </div>
      )}

      {hasSub && (
        <div className="alert alert--success" role="status" style={{ marginBottom: 16 }}>
          Bạn đang có gói hiệu lực đến <strong>{formatDate(currentEnd)}</strong>. Mua thêm sẽ{' '}
          <strong>cộng dồn</strong> thời hạn.
        </div>
      )}
      {!hasSub && user?.role === 'USER' && me.data && (
        <div className="alert" role="status" style={{ marginBottom: 16 }}>
          Bạn chưa có gói đang hiệu lực{currentEnd ? ` (gói trước hết hạn ${formatDate(currentEnd)})` : ''}.
        </div>
      )}
      {notice && (
        <div className="alert alert--success" role="status" style={{ marginBottom: 16 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert--error" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="Chưa có gói nào" hint="Quay lại sau hoặc liên hệ quản trị." />
      ) : (
        <ul className="plan-grid">
          {items.map((p) => {
            const isFree = !!(p.isFree || p.price <= 0);
            const lockedFree = isFree && freeUsed;
            return (
              <li
                key={p.id}
                className={`plan-card${lockedFree ? ' plan-card--disabled' : ''}`}
              >
                <div className="plan-card__body">
                  <h2 className="plan-card__title">{p.name}</h2>
                  <p className="plan-card__desc">{p.description || '—'}</p>
                  <p className="plan-card__price">
                    {isFree ? 'Miễn phí' : formatPrice(p.price)}
                  </p>
                  <p className="plan-card__meta">{p.durationDays} ngày</p>
                  {isFree && (
                    <p className="plan-card__meta">
                      {lockedFree
                        ? 'Bạn đã nhận gói miễn phí (mỗi tài khoản một lần)'
                        : 'Mỗi tài khoản chỉ nhận một lần'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  disabled={busy || lockedFree}
                  onClick={() => {
                    if (!user) {
                      navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.PLANS } } });
                      return;
                    }
                    setError('');
                    setPicked(p);
                  }}
                >
                  {lockedFree
                    ? 'Đã nhận'
                    : !user
                      ? 'Đăng nhập để đăng ký'
                      : isFree
                        ? 'Nhận gói miễn phí'
                        : 'Đăng ký gói'}
                </button>
              </li>
            );
          })}
        </ul>
      )}


      <ConfirmDialog
        open={!!picked}
        title={picked ? `Xác nhận: ${picked.name}` : 'Xác nhận'}
        message={
          picked
            ? [
                hasSub && currentEnd
                  ? `Gói hiện tại còn hạn đến ${formatDate(currentEnd)}.`
                  : 'Bạn chưa có gói đang hiệu lực.',
                picked.isFree || picked.price <= 0
                  ? 'Nhận gói miễn phí (mỗi tài khoản một lần).'
                  : `Thanh toán ${formatPrice(picked.price)} từ ví. Thời hạn ${picked.durationDays} ngày (cộng dồn nếu còn hạn).`,
              ].join(' ')
            : ''
        }
        confirmLabel={picked && (picked.isFree || picked.price <= 0) ? 'Nhận gói' : 'Thanh toán'}
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={confirmBuy}
        onCancel={() => setPicked(null)}
      />
    </div>
  );
}
