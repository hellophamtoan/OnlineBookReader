import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Field from '../common/Field';
import { planAdminService } from '../../services/admin/planadminservice';
import { BANK_OPTIONS, binFromBankName, bankNameFromBin } from '../../utils/bankBins';
import { toMessage } from '../../utils/errors';

/** Preview QR VietQR từ BIN + STK (không upload ảnh) */
function previewQrUrl(bin: string, accountNo: string, accountName: string) {
  const acc = accountNo.replace(/\D/g, '');
  const b = bin.replace(/\D/g, '');
  if (!/^\d{6}$/.test(b) || acc.length < 6) return null;
  const q = new URLSearchParams({
    accountName: accountName.trim().toUpperCase() || 'RECEIVER',
  });
  return `https://img.vietqr.io/image/${b}-${acc}-print.jpg?${q.toString()}`;
}

export default function AdminBankAccountForm() {
  const [bankName, setBankName] = useState('MB Bank');
  const [accountNo, setAccountNo] = useState('0989807884');
  const [accountName, setAccountName] = useState('NGUYEN VAN HA');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const bin = useMemo(() => binFromBankName(bankName) || '', [bankName]);
  const previewUrl = useMemo(
    () => previewQrUrl(bin, accountNo, accountName),
    [bin, accountNo, accountName],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await planAdminService.getStoreBankAccount();
        if (cancelled) return;
        if (data.bank) {
          const name =
            data.bank.bankName ||
            bankNameFromBin(data.bank.bin) ||
            'MB Bank';
          setBankName(name);
          setAccountNo(data.bank.accountNo || '0989807884');
          setAccountName(data.bank.accountName || 'NGUYEN VAN HA');
        }
      } catch (e) {
        if (!cancelled) setError(toMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const resolvedBin = binFromBankName(bankName);
    if (!resolvedBin) {
      setError('Vui lòng chọn ngân hàng trong danh sách.');
      return;
    }
    const stk = accountNo.replace(/\D/g, '');
    if (stk.length < 6 || stk.length > 20) {
      setError('Số tài khoản không hợp lệ (6–20 chữ số).');
      return;
    }
    if (accountName.trim().length < 3) {
      setError('Tên chủ tài khoản tối thiểu 3 ký tự.');
      return;
    }
    setBusy(true);
    try {
      const data = await planAdminService.updateStoreBankAccount({
        bin: resolvedBin,
        accountNo: stk,
        accountName: accountName.trim().toUpperCase(),
        bankName: bankName.trim(),
      });
      setNotice('Đã lưu tài khoản nhận tiền. User nạp ví sẽ thấy Ngân hàng, STK, tên chủ TK và mã QR.');
      setAccountNo(data.bank.accountNo);
      setAccountName(data.bank.accountName);
      setBankName(data.bank.bankName || bankNameFromBin(data.bank.bin) || bankName);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="field__hint">Đang tải tài khoản nhận tiền…</p>;

  return (
    <form className="admin-form form-section admin-form--aligned" onSubmit={onSubmit}>
      <legend className="form-section__title">Tài khoản nhận tiền (nạp ví QR)</legend>
      <p className="field__hint">
        Chọn ngân hàng, nhập STK và tên chủ TK. Hệ thống tự gắn mã BIN và tạo QR VietQR — không cần tải ảnh.
      </p>

      <label className="field">
        <span className="field__label">Ngân hàng</span>
        <select
          className="input"
          name="bankName"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
        >
          {BANK_OPTIONS.map((b) => (
            <option key={b.bin} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      <div className="admin-form__row">
        <Field
          label="Số tài khoản (STK)"
          name="accountNo"
          value={accountNo}
          onChange={(e) => setAccountNo(e.target.value)}
          required
        />
        <Field
          label="Tên chủ tài khoản"
          name="accountName"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
        />
      </div>

      {/* Hiện thông tin nhận tiền ngay khi đã nhập */}
      {(bankName || accountNo || accountName) && (
        <section className="admin-user-card" aria-label="Tài khoản nhận tiền">
          <h3 className="admin-user-card__title">Thông tin nhận tiền</h3>
          <dl className="admin-user-card__list">
            <div className="admin-user-card__row">
              <dt>Ngân hàng</dt>
              <dd>{bankName || '—'}</dd>
            </div>
            <div className="admin-user-card__row">
              <dt>STK</dt>
              <dd>
                <strong>{accountNo.replace(/\D/g, '') || '—'}</strong>
              </dd>
            </div>
            <div className="admin-user-card__row">
              <dt>Tên chủ TK</dt>
              <dd>{accountName.trim().toUpperCase() || '—'}</dd>
            </div>
          </dl>
          {previewUrl && (
            <div className="admin-qr-preview">
              <img src={previewUrl} alt="Xem trước mã QR VietQR" width={220} height={220} />
              <p className="field__hint">
                QR xem trước (chưa gắn số tiền). User chọn số tiền sẽ có QR kèm amount.
              </p>
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert--success" role="status">
          {notice}
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu tài khoản nhận tiền'}
      </button>
    </form>
  );
}
