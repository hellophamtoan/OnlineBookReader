// hooks/useForm.ts
// Giữ giá trị + lỗi từng ô của form; gõ lại thì xóa lỗi của ô đó.
import { useState } from 'react';
import type { ChangeEvent } from 'react';

export function useForm<T extends Record<string, string>>(initial: T) {
  type Errors = Record<keyof T, string>;
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors>(
    Object.fromEntries(Object.keys(initial).map((k) => [k, ''])) as Errors
  );

  // Dùng được cho <input>, <textarea> và <select>
  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((er) => (er[name as keyof T] ? { ...er, [name]: '' } : er));
  };

  // Gán lỗi cho một ô (vd. lỗi 409 trùng email do server trả về)
  const setFieldError = (name: keyof T, message: string) => setErrors((er) => ({ ...er, [name]: message }));

  return { values, setValues, errors, setErrors, setFieldError, onChange };
}
