import { PAYMENT_METHODS } from '../../config/orders';
import type { PaymentMethod } from '../../types';
import { formatPrice } from '../../utils/format';

interface PaymentMethodPickerProps {
  value: string;
  total: number;
  walletBalance: number | null; // null = chưa biết số dư (chưa tải được hồ sơ) -> không chặn, để server kiểm tra
  error?: string;
  disabled?: boolean;
  onChange: (method: PaymentMethod) => void;
}

// Chọn hình thức thanh toán (UC004 bước 5). Ví không đủ số dư thì khóa lựa chọn và nói rõ thiếu bao nhiêu;
// server vẫn kiểm tra lại (INSUFFICIENT_BALANCE).
export default function PaymentMethodPicker({ value, total, walletBalance, error, disabled, onChange }: PaymentMethodPickerProps) {
  return (
    <fieldset className="pay">
      <legend className="field__label">Hình thức thanh toán</legend>
      {PAYMENT_METHODS.map((m) => {
        const isWallet = m.value === 'WALLET' && walletBalance !== null;
        const short = isWallet && walletBalance < total;
        const hint = !isWallet
          ? m.hint
          : short
            ? `Số dư ${formatPrice(walletBalance)} không đủ, còn thiếu ${formatPrice(total - walletBalance)}. Liên hệ cửa hàng để nạp thêm.`
            : `Số dư hiện tại: ${formatPrice(walletBalance)}`;
        return (
          <label key={m.value} className={`pay__opt${value === m.value ? ' is-checked' : ''}${short ? ' is-disabled' : ''}`}>
            <input type="radio" name="paymentMethod" value={m.value} checked={value === m.value} disabled={short || disabled} onChange={() => onChange(m.value)} />
            <span className="pay__text">
              <span className="pay__label">{m.label}</span>
              <span className="pay__hint">{hint}</span>
            </span>
          </label>
        );
      })}
      {error && <p className="field__error" role="alert">{error}</p>}
    </fieldset>
  );
}
