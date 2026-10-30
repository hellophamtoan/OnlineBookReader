// services/userservice.ts
// UC012 — API-08 GET /users/me | API-09 PUT /users/me (đã chốt theo FE)
// Đổi mật khẩu: currentPassword + newPassword + confirmNewPassword (cả ba bắt buộc khi đổi)
import type { UserProfile } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapProfile } from './mappers';

export interface UpdateProfilePayload {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  avatarUrl: string;
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

const normalizeAvatar = (raw: string): string | null => {
  const v = raw.trim();
  if (!v) return null;
  return v.length > 2_000_000 ? v.slice(0, 2_000_000) : v;
};

export const userService = {
  async getProfile(): Promise<UserProfile> {
    return mapProfile((await api.get(ENDPOINTS.users.me)).data);
  },

  async updateProfile(p: UpdateProfilePayload): Promise<UserProfile> {
    const body: Record<string, unknown> = {
      fullName: p.fullName.trim(),
      email: p.email.trim().toLowerCase(),
      phone: p.phone.trim() || null,
      address: (p.address ?? '').trim() || null,
      avatarUrl: normalizeAvatar(p.avatarUrl),
    };
    if (p.newPassword) {
      body.currentPassword = p.currentPassword ?? '';
      body.newPassword = p.newPassword;
      body.confirmNewPassword = p.confirmNewPassword ?? '';
    }
    return mapProfile((await api.put(ENDPOINTS.users.me, body)).data);
  },
};
