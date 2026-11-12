// utils/profileValidators.ts
// UC012 - validate form hồ sơ (API-09).
// Chỉ bắt buộc mật khẩu khi người dùng muốn ĐỔI mật khẩu (có nhập mật khẩu mới).
import { MESSAGES, RULES } from '../config/rules';
import { PROFILE_MESSAGES, PROFILE_RULES } from '../config/profile';
import { validateEmail, validateFullName, validateOptionalConfirm, validateOptionalPassword } from './validators';
import type { FormErrors } from './validators';

export type ProfileFormValues = Record<
  'fullName' | 'email' | 'phone' | 'address' | 'avatarUrl' | 'currentPassword' | 'newPassword' | 'confirmNewPassword',
  string
>;

// [Xử lý] Kiểm tra SĐT (không bắt buộc).
export const validatePhoneOptional = (v: string) => {
  const s = v.trim();
  return !s || RULES.PHONE_REGEX.test(s) ? '' : MESSAGES.phoneInvalid;
};

// [Xử lý] Kiểm tra địa chỉ (không bắt buộc).
/** Địa chỉ không bắt buộc; nếu nhập thì phải đủ độ dài rõ ràng */
export const validateAddressOptional = (v: string) => {
  const s = v.trim();
  if (!s) return '';
  if (s.length < RULES.ADDRESS_MIN) {
    return `${MESSAGES.addressProfileTooShort} (đang có ${s.length} ký tự)`;
  }
  if (s.length > RULES.ADDRESS_MAX) {
    return `${MESSAGES.addressProfileTooLong} (đang có ${s.length} ký tự)`;
  }
  return '';
};

// [Xử lý] Kiểm tra link ảnh đại diện.
export const validateAvatarUrl = (v: string) => {
  const s = v.trim();
  if (!s) return '';
  if (s.startsWith('data:image/')) return '';
  if (s.length > PROFILE_RULES.AVATAR_URL_MAX) return PROFILE_MESSAGES.avatarTooLong;
  return PROFILE_RULES.AVATAR_URL_REGEX.test(s) ? '' : PROFILE_MESSAGES.avatarInvalid;
};

// [Xử lý] Kiểm tra toàn bộ form hồ sơ.
export const validateProfile = (v: ProfileFormValues): FormErrors<ProfileFormValues> => {
  const newPw = v.newPassword.trim();
  const confirm = v.confirmNewPassword.trim();
  const current = v.currentPassword.trim();
  const changingPassword = !!newPw;

  return {
    fullName: validateFullName(v.fullName),
    email: validateEmail(v.email),
    phone: validatePhoneOptional(v.phone),
    address: validateAddressOptional(v.address),
    avatarUrl: validateAvatarUrl(v.avatarUrl),
    currentPassword: changingPassword && !current ? PROFILE_MESSAGES.currentPasswordRequired : '',
    newPassword: changingPassword ? validateOptionalPassword(v.newPassword) : '',
    confirmNewPassword: changingPassword
      ? validateOptionalConfirm(v.newPassword, v.confirmNewPassword) ||
        (!confirm ? MESSAGES.confirmRequired : '')
      : confirm && !newPw
        ? 'Nhập mật khẩu mới nếu muốn đổi mật khẩu'
        : '',
  };
};
