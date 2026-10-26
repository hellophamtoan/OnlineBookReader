// utils/profileValidators.ts
// UC012 - validate form hồ sơ (API-09). Đổi mật khẩu bắt buộc có mật khẩu hiện tại.
import { MESSAGES, RULES } from '../config/rules';
import { PROFILE_MESSAGES, PROFILE_RULES } from '../config/profile';
import { validateEmail, validateFullName, validateOptionalConfirm, validateOptionalPassword } from './validators';
import type { FormErrors } from './validators';

export type ProfileFormValues = Record<
  'fullName' | 'email' | 'phone' | 'avatarUrl' | 'currentPassword' | 'newPassword' | 'confirmNewPassword',
  string
>;

export const validatePhoneOptional = (v: string) => {
  const s = v.trim();
  return !s || RULES.PHONE_REGEX.test(s) ? '' : MESSAGES.phoneInvalid;
};

export const validateAvatarUrl = (v: string) => {
  const s = v.trim();
  if (!s) return '';
  if (s.length > PROFILE_RULES.AVATAR_URL_MAX) return PROFILE_MESSAGES.avatarTooLong;
  return PROFILE_RULES.AVATAR_URL_REGEX.test(s) ? '' : PROFILE_MESSAGES.avatarInvalid;
};

export const validateProfile = (v: ProfileFormValues): FormErrors<ProfileFormValues> => {
  const changingPassword = !!(v.newPassword.trim() || v.confirmNewPassword.trim() || v.currentPassword.trim());
  return {
    fullName: validateFullName(v.fullName),
    email: validateEmail(v.email),
    phone: validatePhoneOptional(v.phone),
    avatarUrl: validateAvatarUrl(v.avatarUrl),
    currentPassword: changingPassword && !v.currentPassword.trim()
      ? PROFILE_MESSAGES.currentPasswordRequired
      : '',
    newPassword: changingPassword
      ? (v.newPassword.trim()
          ? validateOptionalPassword(v.newPassword)
          : PROFILE_MESSAGES.passwordWeak)
      : validateOptionalPassword(v.newPassword),
    confirmNewPassword: changingPassword
      ? validateOptionalConfirm(v.newPassword, v.confirmNewPassword) ||
        (!v.confirmNewPassword.trim() ? MESSAGES.confirmRequired : '')
      : validateOptionalConfirm(v.newPassword, v.confirmNewPassword),
  };
};
