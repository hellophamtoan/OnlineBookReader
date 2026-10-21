// utils/validators.ts
// Validate phía client theo "Quy tắc validate" của hợp đồng/báo cáo. Hàm trả về '' nếu hợp lệ, ngược lại là câu lỗi.
// Server vẫn validate lại (không tin Client).
import { MESSAGES, RULES } from '../config/rules';
import type { RegisterPayload } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateFullName = (v: string) => {
  const n = v.trim().length;
  return n >= RULES.FULL_NAME_MIN && n <= RULES.FULL_NAME_MAX ? '' : MESSAGES.fullName;
};

export const validateEmail = (v: string) => {
  const s = v.trim();
  if (!s) return MESSAGES.emailRequired;
  return EMAIL_REGEX.test(s) && s.length <= RULES.EMAIL_MAX ? '' : MESSAGES.emailInvalid;
};

export const validatePassword = (v: string) => {
  if (!v) return MESSAGES.passwordRequired;
  return v.length >= RULES.PASSWORD_MIN && /[A-Za-z]/.test(v) && /\d/.test(v) ? '' : MESSAGES.passwordWeak;
};

export const validateConfirm = (password: string, confirm: string) => {
  if (!confirm) return MESSAGES.confirmRequired;
  return password === confirm ? '' : MESSAGES.confirmMismatch;
};

export type FormErrors<T> = Record<keyof T, string>;
export const hasErrors = (errors: Record<string, string>) => Object.values(errors).some(Boolean);

export const validateRegister = (v: RegisterPayload): FormErrors<RegisterPayload> => ({
  fullName: validateFullName(v.fullName),
  email: validateEmail(v.email),
  password: validatePassword(v.password),
  confirmPassword: validateConfirm(v.password, v.confirmPassword),
});

// Đăng nhập: chỉ kiểm tra rỗng/định dạng; KHÔNG kiểm tra độ mạnh mật khẩu (tài khoản cũ có thể khác quy tắc)
export const validateLogin = (v: { email: string; password: string }) => ({
  email: validateEmail(v.email),
  password: v.password ? '' : MESSAGES.passwordRequired,
});
