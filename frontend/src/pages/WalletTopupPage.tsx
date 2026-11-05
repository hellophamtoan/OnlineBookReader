// Trang nạp ví: nhập số tiền → hiện QR VietQR → chờ CK thành công → cộng ví
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingBlock } from '../components/common/States';
import { ROUTES } from '../config/routes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userservice';
import { walletService, type TopupResult, type TopupStatus, type TopupRequestItem } from '../services/walletservice';
import { formatPrice, formatDateTime } from '../utils/format';
import { topupStatusLabel } from '../utils/topupStatus';
import { toMessage } from '../utils/errors';

const PRESETS = [50000, 100000, 200000, 500000, 1000000];
const MIN = 10_000;
const MAX = 50_000_000;

type Step = 'form' | 'qr' | 'success' | 'failed';

export default function WalletTopupPage() {
  useDocumentTitle('Nạp tiền vào ví');
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState(100000);
  const [custom, setCustom] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [topup, setTopup] = useState<TopupResult | null>(null);
  const [status, setStatus] = useState<TopupStatus | null>(null);
  const [history, setHistory] = useState<TopupRequestItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveAmount = custom.trim() ? Number(custom.replace(/\D/g, '')) : amount;
  const amountValid =
    Number.isInteger(effectiveAmount) && effectiveAmount >= MIN && effectiveAmount <= MAX;


  const reloadHistory = useCallback(() => {
    setHistLoading(true);
    walletService
      .listTopupRequests(50)
      .then((items) => setHistory(items))
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  }, []);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  useEffect(() => {
    let cancelled = false;
    userService
      .getProfile()
      .then((p) => {
        if (!cancelled) setBalance(p.walletBalance);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPoll = useCallback((orderCode: string) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const st = await walletService.getStatus(orderCode);
        setStatus(st);
        if (st.status === 'PAID') {
          stopPoll();
          setBalance(st.walletBalance);
          setStep('success');
          reloadHistory();
        } else if (st.status === 'FAILED' || st.status === 'CANCELLED' || st.status === 'EXPIRED') {
          stopPoll();
          setStep('failed');
          setError(`Giao dịch ${st.status.toLowerCase()}.`);
        }
      } catch {
        // giữ polling, lỗi tạm thời
      }
    }, 3000);
  }, []);

  useEffect(() => () => stopPoll(), []);

  const submit = async () => {
    setError('');
    if (!amountValid) {
      setError(`Số tiền phải từ ${formatPrice(MIN)} đến ${formatPrice(MAX)}.`);
      return;
    }
    setLoading(true);
    try {
      const result = await walletService.createTopup(effectiveAmount, 'BANK_QR');
      setTopup(result);
      setStep('qr');
      reloadHistory();
      startPoll(result.orderCode);
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    stopPoll();
    setStep('form');
    setTopup(null);
    setStatus(null);
    setError('');
  };

  if (user?.role === 'ADMIN') {
    return (
      <div className="container page profile-page">
        <h1 className="page__title">Nạp tiền vào ví</h1>
        <p>Tài khoản quản trị không sử dụng ví nạp tiền.</p>
        <Link to={ROUTES.PROFILE} className="btn btn--ghost">
          Quay lại
        </Link>
      </div>
    );
  }

  return (
    <div className="container page profile-page wallet-topup-page">
      <h1 className="page__title">Nạp tiền vào ví</h1>
      {balance != null && (
        <p className="wallet-topup-page__balance">
          Số dư hiện tại: <strong>{formatPrice(balance)}</strong>
        </p>
      )}

      {step === 'form' && (
        <section className="profile-card wallet-topup-form" aria-label="Nhập số tiền nạp">
          <fieldset className="field">
            <legend className="field__label">Chọn số tiền muốn nạp</legend>
            <div className="wallet-topup-modal__presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`btn btn--sm ${!custom && amount === p ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => {
                    setAmount(p);
                    setCustom('');
                  }}
                >
                  {formatPrice(p)}
                </button>
              ))}
            </div>
            <label className="field" style={{ marginTop: 16 }}>
              <span className="field__label">Hoặc nhập số tiền khác (VNĐ)</span>
              <input
                type="text"
                inputMode="numeric"
                className="input"
                placeholder="Ví dụ: 150000"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            {!amountValid && custom.trim() !== '' && (
              <p className="field__error">Tối thiểu {formatPrice(MIN)}, tối đa {formatPrice(MAX)}.</p>
            )}
          </fieldset>

          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}

          <div className="profile-card__actions">
            <Link to={ROUTES.PROFILE} className="btn btn--ghost">
              Hủy
            </Link>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submit}
              disabled={loading || !amountValid}
            >
              {loading ? 'Đang tạo mã QR...' : `Thanh toán ${amountValid ? formatPrice(effectiveAmount) : '—'}`}
            </button>
          </div>
        </section>
      )}

      {step === 'qr' && topup && (
        <section className="profile-card wallet-topup-qr" aria-label="Quét mã QR chuyển khoản">
          <h2 className="wallet-topup-qr__title">Quét mã QR để chuyển khoản</h2>
          <p className="wallet-topup-qr__hint">
            Mở app ngân hàng → quét QR → kiểm tra <strong>đúng số tiền</strong> và{' '}
            <strong>nội dung chuyển khoản</strong> → xác nhận. Hệ thống sẽ tự cộng tiền vào ví khi nhận
            được giao dịch.
          </p>

          <div className="wallet-topup-qr__image-wrap">
            {topup.qrImageUrl ? (
              <img
                src={topup.qrImageUrl}
                alt="Mã QR chuyển khoản nạp ví"
                className="wallet-topup-qr__image"
                width={320}
                height={320}
              />
            ) : (
              <LoadingBlock label="Đang tải mã QR..." />
            )}
          </div>

          <dl className="wallet-topup-qr__meta detail__meta">
            <div>
              <dt>Số tiền</dt>
              <dd>
                <strong>{formatPrice(topup.amount)}</strong>
              </dd>
            </div>
            <div>
              <dt>Nội dung CK</dt>
              <dd>
                <code className="wallet-topup-qr__code">{topup.transferContent || topup.orderCode}</code>
              </dd>
            </div>
            {topup.bank?.bankName && (
              <div>
                <dt>Ngân hàng</dt>
                <dd>{topup.bank.bankName}</dd>
              </div>
            )}
            {topup.bank?.accountNo && (
              <div>
                <dt>STK</dt>
                <dd>
                  <strong>{topup.bank.accountNo}</strong>
                </dd>
              </div>
            )}
            {topup.bank?.accountName && (
              <div>
                <dt>Tên chủ TK</dt>
                <dd>{topup.bank.accountName}</dd>
              </div>
            )}
          </dl>

          <p className="wallet-topup-qr__waiting" role="status">
            {status?.status === 'PENDING' || !status
              ? 'Chờ xác nhận…'
              : status.status === 'PAID'
                ? 'Đã nạp'
                : `Trạng thái: ${topupStatusLabel(status.status)}`}
          </p>

          <div className="profile-card__actions">
            <button type="button" className="btn btn--ghost" onClick={reset}>
              Hủy / tạo giao dịch khác
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={async () => {
                if (!topup) return;
                try {
                  const st = await walletService.getStatus(topup.orderCode);
                  setStatus(st);
                  if (st.status === 'PAID') {
                    stopPoll();
                    setBalance(st.walletBalance);
                    setStep('success');
                  }
                } catch (e) {
                  setError(toMessage(e));
                }
              }}
            >
              Tôi đã chuyển khoản — kiểm tra lại
            </button>
          </div>
        </section>
      )}

      {step === 'success' && (
        <div className="alert alert--success" role="status">
          <p>
            <strong>Nạp tiền thành công!</strong>
          </p>
          {topup && <p>Số tiền: {formatPrice(topup.amount)}</p>}
          {balance != null && <p>Số dư ví hiện tại: {formatPrice(balance)}</p>}
          <div className="profile-card__actions" style={{ marginTop: 16 }}>
            <Link to={ROUTES.PROFILE} className="btn btn--primary">
              Về trang tài khoản
            </Link>
            <button type="button" className="btn btn--ghost" onClick={reset}>
              Nạp thêm
            </button>
          </div>
        </div>
      )}


      <section className="profile-card" style={{ marginTop: 24 }} aria-label="Lịch sử nạp ví">
        <h2 className="wallet-topup-qr__title">Lịch sử nạp ví</h2>
        <p className="field__hint">
          Yêu cầu nạp: <strong>Chờ xác nhận</strong> khi đã tạo QR; chuyển thành <strong>Đã nạp</strong> sau khi nhận tiền.
        </p>
        {histLoading && <p className="field__hint">Đang tải…</p>}
        {!histLoading && history.length === 0 && (
          <p className="field__hint">Chưa có yêu cầu nạp ví.</p>
        )}
        {!histLoading && history.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian yêu cầu nạp</th>
                  <th>Thời gian nạp</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDateTime(h.createdAt) || h.createdAt}</td>
                    <td>
                      {h.status === 'PAID' && h.paidAt
                        ? formatDateTime(h.paidAt) || h.paidAt
                        : '—'}
                    </td>
                    <td>
                      <strong>+{formatPrice(h.amount)}</strong>
                    </td>
                    <td>
                      <span className={h.status === 'PAID' ? 'text-ok' : undefined}>
                        {topupStatusLabel(h.status)}
                      </span>
                    </td>
                    <td>{h.transferContent || h.orderCode || h.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {step === 'failed' && (
        <div className="alert alert--error" role="alert">
          <p>
            <strong>Giao dịch không thành công</strong>
          </p>
          <p>{error || 'Vui lòng thử lại.'}</p>
          <div className="profile-card__actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn--primary" onClick={reset}>
              Thử lại
            </button>
            <Link to={ROUTES.PROFILE} className="btn btn--ghost">
              Về tài khoản
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
