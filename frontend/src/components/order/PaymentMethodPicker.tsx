import { PAYMENT_METHODS } from '../../config/orders';
import type { PaymentMethod } from '../../types';
import { formatPrice } from '../../utils/format';

interface PaymentMethodPickerProps {
  value: string;
  total: number;
  walletBalance: number | null; // null = chưa biết số dư -> không chặn, để server kiểm tra
  error?: string;
  disabled?: boolean;
  onChange: (method: PaymentMethod) => void;
}

// Chọn hình thức thanh toán (UC004). Ví không đủ thì khóa và hiện chữ đỏ bên dưới.
export default function PaymentMethodPicker({
  value,
  total,
  walletBalance,
  error,
  disabled,
  onChange,
}: PaymentMethodPickerProps) {
  const walletShort = walletBalance !== null && walletBalance < total;
  const missing = walletShort && walletBalance !== null ? total - walletBalance : 0;

  return (
    <fieldset className="pay">
      <legend className="field__label">Hình thức thanh toán</legend>
      {PAYMENT_METHODS.map((m) => {
        const isWallet = m.value === 'WALLET';
        const locked = isWallet && walletShort;
        const hint = !isWallet
          ? m.hint
          : walletBalance === null
            ? m.hint
            : locked
              ? `Số dư ${formatPrice(walletBalance)} không đủ (đơn ${formatPrice(total)}).`
              : `Số dư hiện tại: ${formatPrice(walletBalance)}`;
        return (
          <label
            key={m.value}
            className={`pay__opt${value === m.value ? ' is-checked' : ''}${locked ? ' is-disabled' : ''}`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={m.value}
              checked={value === m.value}
              disabled={locked || disabled}
              onChange={() => {
                if (!locked) onChange(m.value);
              }}
            />
            <span className="pay__text">
              <span className="pay__label">{m.label}</span>
              <span className={`pay__hint${locked ? ' pay__hint--danger' : ''}`}>{hint}</span>
            </span>
          </label>
        );
      })}
      {walletShort && (
        <p className="field__error pay__wallet-error" role="alert">
          Ví không đủ tiền để thanh toán đơn này (thiếu {formatPrice(missing)}). Vui lòng chọn COD hoặc nạp thêm
          tiền vào ví.
        </p>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
