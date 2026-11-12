// services/authservice.ts
// UC001 / UC002 — API-01..04
import { AUTH } from '../config/rules';
import type { AuthUser, LoginResult, RegisterPayload } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapUser } from './mappers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export const authService = {
  // [Gọi API] POST /auth/register – trang Đăng ký.
  async register(payload: RegisterPayload): Promise<AuthUser> {
    const res = await api.post<Raw>(ENDPOINTS.auth.register, {
      fullName: payload.fullName.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
    return mapUser(res.data?.user ?? res.data);
  },

  // [Gọi API] POST /auth/login – trang Đăng nhập, nhận token và thông tin user.
  async login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post<Raw>(ENDPOINTS.auth.login, {
      email: email.trim().toLowerCase(),
      password,
    });
    const token = String(res.data?.token ?? res.data?.accessToken ?? '');
    if (!token) throw new Error('Máy chủ không trả token đăng nhập');
    return { token, user: mapUser(res.data?.user ?? res.data) };
  },

  // [Gọi API] GET /auth/me – khôi phục user khi tải lại trang.
  async getMe(): Promise<AuthUser> {
    const res = await api.get<Raw>(ENDPOINTS.auth.me);
    return mapUser(res.data?.user ?? res.data);
  },

  // [Gọi API] POST /auth/logout – nút Đăng xuất.
  async logout(): Promise<void> {
    if (!AUTH.LOGOUT_CALLS_SERVER) return;
    try {
      await api.post(ENDPOINTS.auth.logout, {});
    } catch (err) {
      console.error('Đăng xuất phía máy chủ thất bại', err);
    }
  },
};
