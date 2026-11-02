// UC005 — Trang gói đọc: cố định / trọn đời / tùy chọn
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
import {
  PLAN_KIND_LABEL,
  PLAN_MIN_DAYS,
  formatDisplayDate,
  formatRangeLabel,
  minEndDate,
  progressivePlanPrice,
  todayYmd,
  validateEndDate,
} from '../utils/planDates';

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
  /** endDate YYYY-MM-DD theo từng gói tùy chọn */
  const [customEnds, setCustomEnds] = useState<Record<number, string>>({});

  if (user?.role === 'ADMIN') {
    return <Navigate to={ROUTES.ADMIN_PLANS} replace />;
  }

  const reload = () => {
    plans.reload();
    me.reload();
  };

  // Custom plan extends from existing rights, not from today when a plan is still active.
  const activeUntil = me.data?.hasActiveSubscription ? me.data.currentEndDate?.slice(0, 10) : null;
  const startYmd = activeUntil && activeUntil > todayYmd() ? activeUntil : todayYmd();
  const minEnd = minEndDate(startYmd);

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
      const endDate =
        picked.planKind === 'custom' ? customEnds[picked.id] || minEnd : undefined;
      if (picked.planKind === 'custom') {
        const check = validateEndDate(startYmd, endDate || '');
        if (!check.ok) {
          setError(check.message);
          setPicked(null);
          setBusy(false);
          return;
        }
      }
      const result = await planService.subscribe(picked.id, endDate);
      const life = result.subscription.isLifetime || picked.planKind === 'lifetime';
      setNotice(
        life
          ? `Đã đăng ký «${result.subscription.planName}» (trọn đời). Bạn không thể đăng ký thêm gói khác.`
          : `Đã đăng ký «${result.subscription.planName}». Hạn đọc đến ${formatDate(result.currentEndDate)}.`,
      );
      setPicked(null);
      reload();
    } catch (e) {
      const msg = toMessage(e);
      if (/số dư|không đủ|INSUFFICIENT/i.test(msg)) {
        setError(`Số dư ví không đủ để đăng ký «${picked.name}». ${msg}`);
      } else {
        setError(msg);
      }
      setPicked(null);
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
  const hasLifetime = !!me.data?.hasLifetime;
  const freeUsed = !!me.data?.freePlanUsed;
  const balance = me.data?.walletBalance;

  return (
    <div className="container page">
      <h1 className="page__title">Gói đọc e-book</h1>
      <p className="field__hint" style={{ marginBottom: 16 }}>
        Đăng ký gói để mở các chương cần quyền đọc. Thanh toán bằng số dư ví
        {balance != null ? ` (hiện có ${formatPrice(balance)})` : ''}.
      </p>

      {!user && (
        <div className="alert" role="status" style={{ marginBottom: 16 }}>
          Bạn chưa đăng nhập. <Link to={ROUTES.LOGIN}>Đăng nhập</Link> để đăng ký gói đọc.
        </div>
      )}

      {hasLifetime && (
        <div className="alert alert--success" role="status" style={{ marginBottom: 16 }}>
          Bạn đang dùng <strong>gói trọn đời</strong> — không thể đăng ký thêm gói khác.
        </div>
      )}
      {!hasLifetime && hasSub && (
        <div className="alert alert--success" role="status" style={{ marginBottom: 16 }}>
          Bạn đang có gói hiệu lực đến <strong>{formatDate(currentEnd)}</strong>. Mua thêm sẽ{' '}
          <strong>cộng dồn</strong> thời hạn.
        </div>
      )}
      {!hasSub && user?.role === 'USER' && me.data && !hasLifetime && (
        <div className="alert" role="status" style={{ marginBottom: 16 }}>
          Bạn chưa có gói đang hiệu lực
          {currentEnd ? ` (gói trước hết hạn ${formatDate(currentEnd)})` : ''}.
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
            const kind = p.planKind ?? 'fixed';
            const isFree = !!(p.isFree || (p.price <= 0 && kind === 'fixed'));
            const lockedFree = isFree && freeUsed;
            const endYmd = customEnds[p.id] || minEnd;
            const customCheck = kind === 'custom' ? validateEndDate(startYmd, endYmd) : null;
            const customPrice =
              kind === 'custom' && customCheck?.ok
                ? progressivePlanPrice(customCheck.days, p.basePrice30 || 60000)
                : null;
            const payAmount =
              kind === 'custom' ? customPrice ?? 0 : kind === 'lifetime' ? p.price : p.price;
            const notEnough =
              !isFree &&
              !lockedFree &&
              user?.role === 'USER' &&
              typeof balance === 'number' &&
              payAmount > 0 &&
              balance < payAmount;
            const blockedLifetime = hasLifetime;

            return (
              <li key={p.id} className="plan-card">
                <div className="plan-card__body">
                  <p className="plan-card__meta">{PLAN_KIND_LABEL[kind]}</p>
                  <h2 className="plan-card__title">{p.name}</h2>
                  <p className="plan-card__desc">{p.description || '—'}</p>

                  {kind === 'custom' ? (
                    <>
                      <p className="plan-card__meta">
                        Đơn giá 30 ngày: <strong>{formatPrice(p.basePrice30 || 0)}</strong>
                      </p>
                      <label className="field" style={{ marginTop: 8 }}>
                        <span className="field__label">Ngày kết thúc</span>
                        <input
                          className="input"
                          type="date"
                          min={minEnd}
                          value={endYmd}
                          disabled={blockedLifetime || lockedFree || !user}
                          onChange={(e) =>
                            setCustomEnds((m) => ({ ...m, [p.id]: e.target.value }))
                          }
                        />
                      </label>
                      {customCheck && !customCheck.ok && (
                        <p className="field__error" role="alert">
                          {customCheck.message}
                        </p>
                      )}
                      {customCheck?.ok && (
                        <p className="plan-card__price" style={{ marginTop: 8 }}>
                          {formatPrice(customPrice ?? 0)}
                        </p>
                      )}
                      {customCheck?.ok && (
                        <p className="plan-card__meta">
                          {formatRangeLabel(startYmd, endYmd, customCheck.days)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="plan-card__price">
                        {isFree ? 'Miễn phí' : formatPrice(p.price)}
                      </p>
                      <p className="plan-card__meta">
                        {kind === 'lifetime' ? 'Trọn đời' : `${p.durationDays} ngày`}
                      </p>
                    </>
                  )}

                  {isFree && (
                    <p className="plan-card__meta">
                      {lockedFree
                        ? 'Bạn đã nhận gói miễn phí (mỗi tài khoản một lần)'
                        : 'Mỗi tài khoản chỉ nhận một lần'}
                    </p>
                  )}
                  {kind === 'lifetime' && (
                    <p className="plan-card__meta">Đăng ký xong sẽ không chọn thêm gói khác.</p>
                  )}
                </div>

                <button
                  type="button"
                  className={`btn btn--block${
                    lockedFree || blockedLifetime ? ' btn--ghost plan-card__btn--used' : ' btn--primary'
                  }`}
                  disabled={busy || lockedFree || blockedLifetime}
                  onClick={() => {
                    if (!user) {
                      navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.PLANS } } });
                      return;
                    }
                    if (blockedLifetime) {
                      setError('Bạn đã có gói trọn đời — không thể đăng ký thêm.');
                      return;
                    }
                    setNotice('');
                    if (kind === 'custom') {
                      const check = validateEndDate(startYmd, customEnds[p.id] || minEnd);
                      if (!check.ok) {
                        setError(check.message);
                        return;
                      }
                      const price = progressivePlanPrice(check.days, p.basePrice30 || 60000);
                      if (typeof balance === 'number' && balance < price) {
                        setError(
                          `Số dư ví không đủ để đăng ký «${p.name}». Cần ${formatPrice(price)}, hiện có ${formatPrice(balance)}.`,
                        );
                        return;
                      }
                    } else if (!isFree && typeof balance === 'number' && balance < p.price) {
                      setError(
                        `Số dư ví không đủ để đăng ký «${p.name}». Cần ${formatPrice(p.price)}, hiện có ${formatPrice(balance)}.`,
                      );
                      return;
                    }
                    setError('');
                    setPicked(p);
                  }}
                >
                  {blockedLifetime
                    ? 'Đã có gói trọn đời'
                    : lockedFree
                      ? 'Đã nhận'
                      : !user
                        ? 'Đăng nhập để đăng ký'
                        : isFree
                          ? 'Nhận gói miễn phí'
                          : notEnough
                            ? 'Không đủ số dư'
                            : kind === 'lifetime'
                              ? 'Đăng ký trọn đời'
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
            ? (() => {
                const kind = picked.planKind ?? 'fixed';
                if (kind === 'custom') {
                  const end = customEnds[picked.id] || minEnd;
                  const check = validateEndDate(startYmd, end);
                  const price = check.ok
                    ? progressivePlanPrice(check.days, picked.basePrice30 || 60000)
                    : 0;
                  return check.ok
                    ? `${formatRangeLabel(startYmd, end, check.days)}. Thanh toán ${formatPrice(price)} từ ví.`
                    : check.message;
                }
                if (kind === 'lifetime') {
                  return `Gói trọn đời — ${formatPrice(picked.price)}. Sau khi đăng ký bạn không thể mua gói khác.`;
                }
                return [
                  hasSub && currentEnd
                    ? `Gói hiện tại còn hạn đến ${formatDate(currentEnd)}.`
                    : 'Bạn chưa có gói đang hiệu lực.',
                  picked.isFree || picked.price <= 0
                    ? 'Nhận gói miễn phí (mỗi tài khoản một lần).'
                    : `Thanh toán ${formatPrice(picked.price)} từ ví. Thời hạn ${picked.durationDays} ngày (cộng dồn nếu còn hạn).`,
                ].join(' ');
              })()
            : ''
        }
        confirmLabel={
          picked && (picked.isFree || (picked.price <= 0 && picked.planKind === 'fixed'))
            ? 'Nhận gói'
            : 'Thanh toán'
        }
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={confirmBuy}
        onCancel={() => setPicked(null)}
      />
    </div>
  );
}
