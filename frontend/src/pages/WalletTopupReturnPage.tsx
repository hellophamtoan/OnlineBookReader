// Trang return sau thanh toán VNPay / MoMo — số dư đã được BE cộng khi IPN/return hợp lệ.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LoadingBlock } from '../components/common/States';
import { ROUTES } from '../config/routes';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { walletService } from '../services/walletservice';
import { formatPrice } from '../utils/format';
import { toMessage } from '../utils/errors';

type Phase = 'loading' | 'success' | 'failed' | 'pending';

export default function WalletTopupReturnPage() {
  useDocumentTitle('Kết quả nạp ví');
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const orderCode =
    params.get('orderCode') || params.get('orderId') || params.get('vnp_TxnRef') || '';
  const statusParam = params.get('status');
  const resultCode = params.get('resultCode');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const applyPaid = (a?: number | string | null, b?: number | string | null, msg?: string) => {
      if (cancelled) return;
      setPhase('success');
      setMessage(msg || 'Nạp tiền thành công. Số dư ví đã được cập nhật.');
      if (a != null && !Number.isNaN(Number(a))) setAmount(Number(a));
      if (b != null && !Number.isNaN(Number(b))) setBalance(Number(b));
    };

    const applyFail = (msg: string) => {
      if (cancelled) return;
      setPhase('failed');
      setMessage(msg);
    };

    const pollStatus = async (code: string, attemptsLeft: number) => {
      try {
        const st = await walletService.getStatus(code);
        if (cancelled) return;
        if (st.status === 'PAID') {
          applyPaid(st.amount, st.walletBalance);
          return;
        }
        if (st.status === 'FAILED' || st.status === 'CANCELLED' || st.status === 'EXPIRED') {
          applyFail(`Giao dịch ${st.status.toLowerCase()}.`);
          return;
        }
        if (attemptsLeft > 0) {
          setPhase('pending');
          setMessage('Đang xác nhận thanh toán với cổng... Vui lòng đợi vài giây.');
          timer = setTimeout(() => pollStatus(code, attemptsLeft - 1), 2000);
        } else {
          setPhase('pending');
          setMessage(
            'Giao dịch đang chờ xác nhận. Nếu đã trừ tiền, số dư ví sẽ cập nhật trong ít phút. Bạn có thể tải lại trang tài khoản.',
          );
          if (st.walletBalance != null) setBalance(st.walletBalance);
        }
      } catch (e) {
        if (!cancelled) applyFail(toMessage(e));
      }
    };

    const run = async () => {
      if (statusParam === 'success') {
        applyPaid(params.get('amount'), params.get('balance'));
        return;
      }
      if (statusParam === 'failed') {
        applyFail(params.get('message') || 'Thanh toán không thành công.');
        return;
      }
      if (resultCode != null && Number(resultCode) !== 0) {
        applyFail(params.get('message') || 'Thanh toán MoMo không thành công.');
        return;
      }
      if (orderCode) {
        await pollStatus(orderCode, 5);
        return;
      }
      applyFail('Thiếu thông tin giao dịch.');
    };

    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderCode, statusParam, resultCode]);

  return (
    <div className="container page profile-page">
      <h1 className="page__title">Kết quả nạp ví</h1>

      {(phase === 'loading' || phase === 'pending') && (
        <>
          <LoadingBlock label={message || 'Đang kiểm tra giao dịch...'} />
          {phase === 'pending' && message && (
            <p className="muted" style={{ marginTop: 12 }}>
              {message}
            </p>
          )}
        </>
      )}

      {phase === 'success' && (
        <div className="alert alert--success" role="status">
          <p>
            <strong>{message}</strong>
          </p>
          {amount != null && <p>Số tiền đã nạp: {formatPrice(amount)}</p>}
          {balance != null && <p>Số dư ví hiện tại: {formatPrice(balance)}</p>}
          {orderCode && <p className="muted">Mã giao dịch: {orderCode}</p>}
        </div>
      )}

      {phase === 'failed' && (
        <div className="alert alert--error" role="alert">
          <p>
            <strong>Nạp tiền thất bại</strong>
          </p>
          <p>{message}</p>
          {orderCode && <p className="muted">Mã giao dịch: {orderCode}</p>}
        </div>
      )}

      <div className="profile-card__actions" style={{ marginTop: 24 }}>
        <Link to={ROUTES.PROFILE} className="btn btn--primary">
          Về trang tài khoản
        </Link>
        <Link to={ROUTES.CART} className="btn btn--ghost">
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  );
}
