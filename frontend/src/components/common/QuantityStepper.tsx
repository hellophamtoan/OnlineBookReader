import { useEffect, useState } from 'react';

interface QuantityStepperProps {
  value: number;
  max: number; // thường là tồn kho; max < min thì ô bị khóa
  min?: number;
  disabled?: boolean;
  label?: string;
  onChange: (next: number) => void; // chỉ gọi khi giá trị thật sự đổi và đã nằm trong [min, max]
}

// Ô chọn số lượng: nút -/+ và ô nhập tay (nhập xong bấm Enter hoặc rời ô thì mới áp dụng).
// Dùng cho trang chi tiết sách (chỉ đổi state) và dòng giỏ hàng (đổi xong gọi API).
export default function QuantityStepper({ value, max, min = 1, disabled, label = 'Số lượng', onChange }: QuantityStepperProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const locked = disabled || max < min;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const apply = (n: number) => {
    const next = clamp(n);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const commitText = () => {
    if (text.trim() === '' || !Number.isInteger(Number(text))) return setText(String(value)); // gõ sai -> trả về số cũ
    apply(Number(text));
  };

  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" className="qty__btn" aria-label="Giảm số lượng" disabled={locked || value <= min} onClick={() => apply(value - 1)}>
        −
      </button>
      <input
        className="qty__input"
        inputMode="numeric"
        aria-label={label}
        value={text}
        disabled={locked}
        onChange={(e) => setText(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitText();
          }
        }}
      />
      <button type="button" className="qty__btn" aria-label="Tăng số lượng" disabled={locked || value >= max} onClick={() => apply(value + 1)}>
        +
      </button>
    </div>
  );
}
