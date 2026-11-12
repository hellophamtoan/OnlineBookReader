// Dialog thêm / sửa gói đọc (UC008).
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import Field from '../common/Field';
import TextAreaField from '../common/TextAreaField';
import {
  PLAN_KIND_LABEL,
  PLAN_MIN_DAYS,
  progressivePlanPrice,
  type PlanKind,
} from '../../utils/planDates';

export type PlanFormState = {
  name: string;
  description: string;
  planKind: PlanKind;
  basePrice30: string;
  price: string;
  durationDays: string;
};

interface AdminPlanFormDialogProps {
  open: boolean;
  editId: number | null;
  form: PlanFormState;
  busy: boolean;
  previewPrice: { label: string; amount: number | null; base: number };
  onChange: (patch: Partial<PlanFormState>) => void;
  onKindChange: (kind: PlanKind) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

// [Giao diện] Admin > Gói đọc: hộp thoại thêm/sửa gói (loại gói, giá, số ngày).
export default function AdminPlanFormDialog({
  open,
  editId,
  form,
  busy,
  previewPrice,
  onChange,
  onKindChange,
  onSubmit,
  onClose,
}: AdminPlanFormDialogProps) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog admin-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-form-title">
        <h2 id="plan-form-title" className="dialog__title">
          {editId != null ? `Sửa gói #${editId}` : 'Thêm gói đọc'}
        </h2>
        <form className="admin-form admin-form--aligned" onSubmit={onSubmit}>
          <Field
            label="Tên gói"
            name="name"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <TextAreaField
            label="Mô tả"
            name="description"
            rows={2}
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />

          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field__label" style={{ marginBottom: 8 }}>
              Loại gói
            </legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(
                [
                  ['fixed', 'Gói cố định — admin chọn số ngày & giá; user chỉ đăng ký hoặc không'],
                  ['lifetime', 'Gói trọn đời — user đăng ký xong không chọn thêm gói khác'],
                  ['custom', 'Gói tùy chọn — admin chỉ định giá 30 ngày; user chọn ngày kết thúc'],
                ] as const
              ).map(([k, hint]) => (
                <label key={k} className="check" style={{ alignItems: 'flex-start' }}>
                  <input
                    type="radio"
                    name="planKind"
                    checked={form.planKind === k}
                    onChange={() => onKindChange(k)}
                  />
                  <span>
                    <strong>{PLAN_KIND_LABEL[k]}</strong>
                    <span className="field__hint" style={{ display: 'block' }}>
                      {hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {form.planKind === 'custom' && (
            <Field
              label="Giá cơ sở 30 ngày (₫)"
              name="basePrice30"
              inputMode="numeric"
              value={form.basePrice30}
              onChange={(e) => onChange({ basePrice30: e.target.value })}
              hint="Đơn giá để tính giá lũy tiến khi user chọn số ngày."
            />
          )}

          {form.planKind === 'fixed' && (
            <div className="admin-form__row">
              <Field
                label="Số ngày"
                name="durationDays"
                inputMode="numeric"
                value={form.durationDays}
                onChange={(e) => onChange({ durationDays: e.target.value })}
              />
              <Field
                label="Giá gói (₫)"
                name="price"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => onChange({ price: e.target.value })}
              />
            </div>
          )}

          {form.planKind === 'lifetime' && (
            <Field
              label="Giá trọn đời (₫)"
              name="price"
              inputMode="numeric"
              value={form.price}
              onChange={(e) => onChange({ price: e.target.value })}
              hint="User đăng ký một lần; không đăng ký thêm gói khác."
            />
          )}

          {form.planKind === 'custom' && (
            <p className="field__hint">
              User sẽ chọn ngày kết thúc (≥ {PLAN_MIN_DAYS} ngày). Giá = công thức lũy tiến từ giá cơ sở 30 ngày.
            </p>
          )}

          <div
            className="alert"
            role="status"
            style={{ marginTop: 8, background: 'var(--bg, #f5f5f7)', borderRadius: 8, padding: '12px 14px' }}
          >
            <strong>Giá hiển thị cuối gói</strong>
            <div style={{ marginTop: 6 }}>
              {previewPrice.amount == null ? (
                <>
                  {previewPrice.label}
                  <br />
                  Ví dụ 30 ngày: <strong>{Number(form.basePrice30 || 0).toLocaleString('vi-VN')} ₫</strong>
                  {' · '}
                  90 ngày:{' '}
                  <strong>
                    {progressivePlanPrice(90, Number(form.basePrice30) || 0).toLocaleString('vi-VN')} ₫
                  </strong>
                </>
              ) : (
                <>
                  {previewPrice.label}:{' '}
                  <strong style={{ fontSize: 18 }}>{previewPrice.amount.toLocaleString('vi-VN')} ₫</strong>
                </>
              )}
            </div>
          </div>

          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {editId != null ? 'Lưu thay đổi' : 'Tạo gói'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
