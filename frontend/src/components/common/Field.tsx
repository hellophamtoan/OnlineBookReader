import { useId, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'name'> {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  password?: boolean; // true -> có nút Hiện/Ẩn mật khẩu
}

// 1 ô nhập của form: nhãn, viền đỏ + dòng lỗi khi có lỗi (đọc được bằng trình đọc màn hình)
export default function Field({ label, name, value, onChange, error, hint, password, type = 'text', ...rest }: FieldProps) {
  const id = useId();
  const [show, setShow] = useState(false);
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  const input = (
    <input
      {...rest}
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      type={password ? (show ? 'text' : 'password') : type}
      className={`input${password ? ' input--has-action' : ''}`}
      aria-invalid={!!error}
      aria-describedby={describedBy}
    />
  );

  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      {password ? (
        <div className="field__wrap">
          {input}
          <button type="button" className="field__toggle" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? 'Ẩn' : 'Hiện'}
          </button>
        </div>
      ) : (
        input
      )}
      {error ? <p id={`${id}-err`} className="field__error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="field__hint">{hint}</p> : null}
    </div>
  );
}
