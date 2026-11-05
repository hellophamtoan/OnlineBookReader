// UC013 — form nạp ví + lịch sử nạp (dưới nút Nạp ví) khi chọn User
import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Field from '../common/Field';
import AdminBankAccountForm from './AdminBankAccountForm';
import type { AdminUserOption } from '../../services/admin/planadminservice';
import {
  planAdminService,
  type UserTopupHistory,
} from '../../services/admin/planadminservice';
import { formatPrice, formatDateTime } from '../../utils/format';
import { topupStatusLabel } from '../../utils/topupStatus';
import { toMessage } from '../../utils/errors';

interface AdminWalletTopupProps {
  userOptions: AdminUserOption[];
  selectedUser?: AdminUserOption;
  topup: { userId: string; amount: string; note: string };
  busy: boolean;
  onChange: (patch: Partial<{ userId: string; amount: string; note: string }>) => void;
  onSubmit: (e: FormEvent) => void;
  historyKey?: number;
}

export default function AdminWalletTopup({
  userOptions,
  selectedUser,
  topup,
  busy,
  onChange,
  onSubmit,
  historyKey = 0,
}: AdminWalletTopupProps) {
  const [history, setHistory] = useState<UserTopupHistory | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState('');
  const [openOrderCode, setOpenOrderCode] = useState<string | null>(null);
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState('');
  const [confirmNotice, setConfirmNotice] = useState('');

  useEffect(() => {
    if (!topup.userId) {
      setHistory(null);
      return;
    }
    let cancelled = false;
    setHistLoading(true);
    setHistError('');
    planAdminService
      .getUserTopupHistory(Number(topup.userId))
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setHistory(null);
          setHistError(toMessage(e));
        }
      })
      .finally(() => {
        if (!cancelled) setHistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topup.userId, historyKey]);

  const txs = history?.transactions ?? [];
  const requests = history?.requests ?? [];

  const reloadHistory = () => {
    if (!topup.userId) return;
    setHistLoading(true);
    planAdminService
      .getUserTopupHistory(Number(topup.userId))
      .then((data) => setHistory(data))
      .catch((e) => setHistError(toMessage(e)))
      .finally(() => setHistLoading(false));
  };

  const onConfirmTopup = async (orderCode: string) => {
    if (!topup.userId) return;
    setConfirmError('');
    setConfirmNotice('');
    setConfirmingCode(orderCode);
    try {
      const data = await planAdminService.confirmUserTopup(Number(topup.userId), orderCode);
      setConfirmNotice(
        `Đã nạp ${formatPrice(data.amount)}. Số dư ví: ${formatPrice(data.balance)}.`,
      );
      setOpenOrderCode(null);
      reloadHistory();
    } catch (e) {
      setConfirmError(toMessage(e));
    } finally {
      setConfirmingCode(null);
    }
  };

  return (
    <div className="admin-topup-page">
      <h2 className="form-section__title" style={{ marginBottom: 8 }}>
        Trang nạp ví
      </h2>
      <p className="field__hint" style={{ marginBottom: 16 }}>
        Cấu hình tài khoản nhận tiền (QR VietQR chuẩn NAPAS — app ngân hàng quét được), chọn user để nạp
        và xem lịch sử.
      </p>

      <AdminBankAccountForm />

      <form className="admin-form form-section admin-form--aligned" onSubmit={onSubmit}>
        <legend className="form-section__title">Nạp ví cho user</legend>
        <p className="field__hint">Chọn user, nhập số tiền và ghi chú, rồi bấm Nạp ví.</p>

        <label className="field">
          <span className="field__label">User (ID — Họ và tên)</span>
          <select
            className="input"
            name="userId"
            value={topup.userId}
            onChange={(e) => onChange({ userId: e.target.value })}
          >
            <option value="">— Chọn user —</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                #{u.id} — {u.fullName}
              </option>
            ))}
          </select>
        </label>

        {selectedUser && (
          <section className="admin-user-card" aria-label="Thông tin cá nhân (chỉ xem)">
            <h3 className="admin-user-card__title">{selectedUser.fullName}</h3>
            <p className="admin-user-card__sub">{selectedUser.email || '—'}</p>
            <dl className="admin-user-card__list">
              <div className="admin-user-card__row">
                <dt>ID</dt>
                <dd>#{selectedUser.id}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Email</dt>
                <dd>{selectedUser.email || '—'}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Số điện thoại</dt>
                <dd>{selectedUser.phone || 'Chưa cập nhật'}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Số dư ví hiện tại</dt>
                <dd>
                  <strong>
                    {formatPrice(history?.user.walletBalance ?? selectedUser.walletBalance ?? 0)}
                  </strong>
                </dd>
              </div>
            </dl>
          </section>
        )}

        <div className="admin-form__row">
          <Field
            label="Số tiền nạp (₫)"
            name="amount"
            value={topup.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
          <Field
            label="Ghi chú"
            name="note"
            value={topup.note}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy || !topup.userId}>
          {busy ? 'Đang nạp…' : 'Nạp ví'}
        </button>
      </form>

      {/* Lịch sử nạp ví — dưới nút Nạp ví */}
      {topup.userId && (
        <section className="admin-form form-section admin-topup-history" aria-label="Lịch sử nạp ví">
          <h3 className="form-section__title">Lịch sử nạp ví</h3>
          <p className="field__hint">
            Yêu cầu nạp QR: <strong>Chờ xác nhận</strong> → sau khi nhận tiền thành <strong>Đã nạp</strong>.
          </p>
          {histLoading && <p className="field__hint">Đang tải lịch sử…</p>}
          {histError && (
            <p className="field__error" role="alert">
              {histError}
            </p>
          )}
          {!histLoading && !histError && requests.length === 0 && txs.length === 0 && (
            <p className="field__hint">Chưa có yêu cầu nạp ví.</p>
          )}
          {confirmNotice && (
            <p className="alert alert--success" role="status">
              {confirmNotice}
            </p>
          )}
          {confirmError && (
            <p className="field__error" role="alert">
              {confirmError}
            </p>
          )}
          {!histLoading && requests.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Thời gian yêu cầu nạp</th>
                    <th>Thời gian nạp</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const isOpen = openOrderCode === r.orderCode;
                    const isPending = r.status === 'PENDING';
                    return (
                      <Fragment key={`req-wrap-${r.id}`}>
                        <tr>
                          <td>{formatDateTime(r.createdAt) || r.createdAt}</td>
                          <td>
                            {r.status === 'PAID' && r.paidAt
                              ? formatDateTime(r.paidAt) || r.paidAt
                              : '—'}
                          </td>
                          <td>
                            <strong>+{formatPrice(r.amount)}</strong>
                          </td>
                          <td>
                            <span
                              className={
                                r.status === 'PAID'
                                  ? 'text-ok'
                                  : r.status === 'PENDING'
                                    ? 'muted'
                                    : ''
                              }
                            >
                              {topupStatusLabel(r.status)}
                            </span>
                          </td>
                          <td>{r.orderCode || r.note || '—'}</td>
                          <td>
                            {isPending ? (
                              <button
                                type="button"
                                className="btn btn--sm btn--primary"
                                onClick={() => {
                                  setConfirmError('');
                                  setConfirmNotice('');
                                  setOpenOrderCode(isOpen ? null : r.orderCode);
                                }}
                              >
                                {isOpen ? 'Đóng' : 'Nạp'}
                              </button>
                            ) : r.status === 'PAID' ? (
                              <span className="text-ok">Đã nạp</span>
                            ) : null}
                          </td>
                        </tr>
                        {isOpen && isPending && (
                          <tr key={`req-detail-${r.id}`} className="admin-topup-confirm-row">
                            <td colSpan={6}>
                              <div className="admin-topup-confirm">
                                <h4 className="admin-user-card__title">Xác nhận nạp ví</h4>
                                <dl className="admin-user-card__list">
                                  <div className="admin-user-card__row">
                                    <dt>Số tiền</dt>
                                    <dd>
                                      <strong>{formatPrice(r.amount)}</strong>
                                    </dd>
                                  </div>
                                  <div className="admin-user-card__row">
                                    <dt>Ghi chú (nội dung CK)</dt>
                                    <dd>
                                      <code>{r.orderCode || r.note || '—'}</code>
                                    </dd>
                                  </div>
                                  <div className="admin-user-card__row">
                                    <dt>Thời gian yêu cầu</dt>
                                    <dd>{formatDateTime(r.createdAt) || r.createdAt}</dd>
                                  </div>
                                </dl>
                                <button
                                  type="button"
                                  className="btn btn--primary"
                                  disabled={confirmingCode === r.orderCode}
                                  onClick={() => onConfirmTopup(r.orderCode)}
                                >
                                  {confirmingCode === r.orderCode ? 'Đang nạp…' : 'Nạp ví'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!histLoading && txs.length > 0 && (
            <>
              <h4 className="field__label" style={{ marginTop: 16 }}>
                Giao dịch ví (admin nạp tay / đã cộng)
              </h4>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thời gian nạp</th>
                      <th>Số tiền</th>
                      <th>Số dư ví sau</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t) => (
                      <tr key={`tx-${t.id}`}>
                        <td>{formatDateTime(t.createdAt) || t.createdAt}</td>
                        <td>
                          <strong className="text-ok">+{formatPrice(t.amount)}</strong>
                        </td>
                        <td>{t.balanceAfter != null ? formatPrice(t.balanceAfter) : '—'}</td>
                        <td>{t.externalReference?.trim() || t.note?.trim() || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
