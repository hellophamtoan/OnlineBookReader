import { useId } from 'react';
import type { ChangeEvent, ReactNode, SelectHTMLAttributes } from 'react';

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value' | 'name'> {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
  hint?: string;
  children: ReactNode; // các <option>
}

// Ô chọn có nhãn + dòng lỗi, cùng kiểu với Field
export default function SelectField({ label, name, value, onChange, error, hint, children, ...rest }: SelectFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <select {...rest} id={id} name={name} value={value} onChange={onChange} className="input" aria-invalid={!!error} aria-describedby={describedBy}>
        {children}
      </select>
      {error ? <p id={`${id}-err`} className="field__error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="field__hint">{hint}</p> : null}
    </div>
  );
}
