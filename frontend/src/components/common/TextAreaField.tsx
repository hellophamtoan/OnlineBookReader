import { useId } from 'react';
import type { ChangeEvent, Ref, TextareaHTMLAttributes } from 'react';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'name'> {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  hint?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
}

// Ô nhập nhiều dòng, cùng kiểu với Field (nhãn, viền đỏ + dòng lỗi)
export default function TextAreaField({ label, name, value, onChange, error, hint, inputRef, className = '', ...rest }: TextAreaFieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">{label}</label>
      <textarea
        {...rest}
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        className={`input textarea ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={describedBy}
      />
      {error ? <p id={`${id}-err`} className="field__error" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="field__hint">{hint}</p> : null}
    </div>
  );
}
