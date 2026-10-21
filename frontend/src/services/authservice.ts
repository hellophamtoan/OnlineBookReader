// services/authservice.ts
// UC001 (API-01), UC002 (API-02, API-03, API-04).
// Service KHÔNG lưu token: việc lưu/xóa phiên do AuthContext làm (một nơi duy nhất).
import { AUTH } from '../config/rules';
import type { AuthUser, LoginResult, RegisterPayload } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapUser } from './mappers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export const authService = {
  // API-01: tạo tài khoản USER. Không trả JWT -> sau khi thành công FE chuyển sang trang đăng nhập.
  async register(payload: RegisterPayload): Promise<AuthUser> {
    const res = await api.post<Raw>(ENDPOINTS.auth.register, {
      fullName: payload.fullName.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
    return mapUser(res.data?.user ?? res.data);
  },

  // API-02
  async login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post<Raw>(ENDPOINTS.auth.login, { email: email.trim().toLowerCase(), password });
    return { token: String(res.data?.token ?? ''), user: mapUser(res.data?.user) };
  },

  // API-03: khôi phục/kiểm tra phiên sau khi tải lại trang
  async getMe(): Promise<AuthUser> {
    const res = await api.get<Raw>(ENDPOINTS.auth.me);
    return mapUser(res.data?.user ?? res.data);
  },

  // API-04: mặc định chỉ xóa token ở client (xem AUTH.LOGOUT_CALLS_SERVER). Không bao giờ ném lỗi.
  async logout(): Promise<void> {
    if (!AUTH.LOGOUT_CALLS_SERVER) return;
    try {
      await api.post(ENDPOINTS.auth.logout);
    } catch (err) {
      console.error('Đăng xuất phía máy chủ thất bại', err);
    }
  },
};
