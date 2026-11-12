// services/mocks/handlers/users.ts
// API-08 GET /users/me | API-09 PUT /users/me (UC012) — khớp FE: đổi MK cần currentPassword
import { MESSAGES, RULES } from '../../../config/rules';
import { PROFILE_MESSAGES, PROFILE_RULES } from '../../../config/profile';
import { findUserByEmail, findUserById, updateUser } from '../db';
import type { MockUser } from '../db';
import { MockHttpError } from '../http';
import type { Route } from '../router';
import { getWallet } from '../shopdb';
import { requireUser } from './auth';
import { failValidation, str } from './common';
import type { FieldErr } from './common';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const profileOf = (u: MockUser) => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  phone: u.phone ?? null,
  address: u.address ?? null,
  avatarUrl: u.avatarUrl ?? null,
  role: u.role,
  walletBalance: getWallet(u),
  createdAt: '2026-08-15T09:30:00.000Z',
});

export const userRoutes: Route[] = [
  {
    method: 'GET',
    path: '/users/me',
    handler: ({ token }) => ({ message: 'Lấy thông tin cá nhân thành công', data: profileOf(requireUser(token)) }),
  },
  {
    method: 'PUT',
    path: '/users/me',
    handler: ({ token, body }) => {
      const user = requireUser(token);
      const b = (body ?? {}) as Record<string, unknown>;
      const fullName = str(b.fullName).trim();
      const email = str(b.email).trim().toLowerCase();
      const phone = str(b.phone).trim();
      const address = str(b.address).trim();
      const avatarUrl = str(b.avatarUrl).trim();
      const currentPassword = str(b.currentPassword);
      const newPassword = str(b.newPassword);
      const confirmNewPassword = str(b.confirmNewPassword);

      const errors: FieldErr[] = [];
      if (fullName.length < RULES.FULL_NAME_MIN || fullName.length > RULES.FULL_NAME_MAX) {
        errors.push({ field: 'fullName', message: MESSAGES.fullName });
      }
      if (!email) errors.push({ field: 'email', message: MESSAGES.emailRequired });
      else if (!EMAIL_REGEX.test(email) || email.length > RULES.EMAIL_MAX) {
        errors.push({ field: 'email', message: MESSAGES.emailInvalid });
      }
      if (phone && !RULES.PHONE_REGEX.test(phone)) {
        errors.push({ field: 'phone', message: MESSAGES.phoneInvalid });
      }
      if (avatarUrl) {
        if (avatarUrl.length > PROFILE_RULES.AVATAR_URL_MAX) {
          errors.push({ field: 'avatarUrl', message: PROFILE_MESSAGES.avatarTooLong });
        } else if (!PROFILE_RULES.AVATAR_URL_REGEX.test(avatarUrl)) {
          errors.push({ field: 'avatarUrl', message: PROFILE_MESSAGES.avatarInvalid });
        }
      }

      // Đổi mật khẩu: bắt buộc currentPassword + newPassword + confirmNewPassword
      if (newPassword || confirmNewPassword || currentPassword) {
        if (!currentPassword) {
          errors.push({ field: 'currentPassword', message: PROFILE_MESSAGES.currentPasswordRequired });
        } else if (currentPassword !== user.password) {
          errors.push({ field: 'currentPassword', message: PROFILE_MESSAGES.currentPasswordWrong });
        }
        if (newPassword.length < RULES.PASSWORD_MIN) {
          errors.push({ field: 'newPassword', message: PROFILE_MESSAGES.passwordWeak });
        }
        if (!confirmNewPassword) {
          errors.push({ field: 'confirmNewPassword', message: MESSAGES.confirmRequired });
        } else if (newPassword !== confirmNewPassword) {
          errors.push({ field: 'confirmNewPassword', message: PROFILE_MESSAGES.passwordMismatch });
        }
      }
      if (errors.length) throw failValidation(errors);

      const other = findUserByEmail(email);
      if (other && other.id !== user.id) {
        throw new MockHttpError(409, PROFILE_MESSAGES.emailTaken, 'EMAIL_EXISTS', [
          { field: 'email', message: PROFILE_MESSAGES.emailTaken },
        ]);
      }

      const patch: Parameters<typeof updateUser>[1] = {
        fullName,
        email,
        phone: phone || null,
        address: address || null,
        avatarUrl: avatarUrl || null,
      };
      if (newPassword) patch.password = newPassword;

      updateUser(user.id, patch);
      return {
        message: 'Cập nhật thông tin cá nhân thành công',
        data: profileOf(findUserById(user.id) ?? user),
      };
    },
  },
];
