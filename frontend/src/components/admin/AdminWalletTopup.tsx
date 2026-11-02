// UC013 — form nạp ví test (chỉ USER).
import type { FormEvent } from 'react';
import Field from '../common/Field';
import type { AdminUserOption } from '../../services/admin/planadminservice';
import { formatPrice } from '../../utils/format';

interface AdminWalletTopupProps {
  userOptions: AdminUserOption[];
  selectedUser?: AdminUserOption;
  topup: { userId: string; amount: string; note: string };
  busy: boolean;
  onChange: (patch: Partial<{ userId: string; amount: string; note: string }>) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function AdminWalletTopup({
  userOptions,
  selectedUser,
  topup,
  busy,
  onChange,
  onSubmit,
}: AdminWalletTopupProps) {
  return (
    <form className="admin-form form-section admin-form--aligned" onSubmit={onSubmit}>
      <legend className="form-section__title">Nạp ví user (UC013 — học tập)</legend>
      <p className="field__hint">Chỉ dùng để test thanh toán ví / mua gói. Không phải cổng thanh toán thật.</p>

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
              <dt>Họ và tên</dt>
              <dd>{selectedUser.fullName}</dd>
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
              <dt>Vai trò</dt>
              <dd>USER</dd>
            </div>
            <div className="admin-user-card__row">
              <dt>Số dư ví</dt>
              <dd>
                <strong>{formatPrice(selectedUser.walletBalance ?? 0)}</strong>
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
        Nạp ví
      </button>
    </form>
  );
}
