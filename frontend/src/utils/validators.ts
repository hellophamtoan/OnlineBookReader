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
  return v.length >= RULES.PASSWORD_MIN ? '' : MESSAGES.passwordWeak;
};

/** Đổi mật khẩu (profile): để trống = không đổi; có nhập thì tối thiểu 8 ký tự */
export const validateOptionalPassword = (v: string) => {
  if (!v) return '';
  return v.length >= RULES.PASSWORD_MIN ? '' : MESSAGES.passwordWeak;
};

export const validateConfirm = (password: string, confirm: string) => {
  if (!confirm) return MESSAGES.confirmRequired;
  return password === confirm ? '' : MESSAGES.confirmMismatch;
};

/** Xác nhận MK mới khi đổi: nếu cả hai trống = OK; nếu một trong hai có giá trị thì phải khớp */
export const validateOptionalConfirm = (password: string, confirm: string) => {
  if (!password && !confirm) return '';
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

// ---------- UC004: thông tin nhận hàng (O01) ----------
export const validateReceiverName = (v: string) => {
  const n = v.trim().length;
  return n >= RULES.RECEIVER_NAME_MIN && n <= RULES.RECEIVER_NAME_MAX ? '' : MESSAGES.receiverName;
};

export const validatePhone = (v: string) => {
  const s = v.trim();
  if (!s) return MESSAGES.phoneRequired;
  return RULES.PHONE_REGEX.test(s) ? '' : MESSAGES.phoneInvalid;
};

export const validateAddress = (v: string) => {
  const n = v.trim().length;
  return n >= RULES.ADDRESS_MIN && n <= RULES.ADDRESS_MAX ? '' : MESSAGES.addressInvalid;
};

export const validateNote = (v: string) => (v.trim().length <= RULES.NOTE_MAX ? '' : MESSAGES.noteTooLong);

export const validatePayment = (v: string) => (v === 'COD' || v === 'WALLET' ? '' : MESSAGES.paymentRequired);

// Số lượng đặt mua: số nguyên >= 1 và <= tồn kho
export const validateQuantity = (q: number, max: number) =>
  Number.isInteger(q) && q >= 1 && q <= max ? '' : MESSAGES.quantityInvalid;

export type CheckoutFormValues = Record<'receiverName' | 'receiverPhone' | 'shippingAddress' | 'paymentMethod' | 'note', string>;

export const validateCheckout = (v: CheckoutFormValues): FormErrors<CheckoutFormValues> => ({
  receiverName: validateReceiverName(v.receiverName),
  receiverPhone: validatePhone(v.receiverPhone),
  shippingAddress: validateAddress(v.shippingAddress),
  paymentMethod: validatePayment(v.paymentMethod),
  note: validateNote(v.note),
});
