// services/mocks/handlers/auth.ts
// Giả lập API-01..04 đúng thứ tự kiểm tra, mã lỗi và thông báo của hợp đồng.
import { MESSAGES, RULES } from '../../../config/rules';
import { addUser, findUserByEmail, findUserById, makeToken, readToken } from '../db';
import type { MockUser } from '../db';
import { MockHttpError } from '../http';
import type { Route } from '../router';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const publicUser = (u: MockUser) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, avatarUrl: u.avatarUrl ?? null });

// Tương đương middleware verifyToken của BE (kiểm tra cả trạng thái tài khoản trong DB - quyết định D1)
export const requireUser = (token: string | null): MockUser => {
  const payload = readToken(token);
  const user = payload ? findUserById(payload.id) : undefined;
  if (!user) throw new MockHttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 'UNAUTHORIZED');
  if (!user.isActive) throw new MockHttpError(403, 'Tài khoản đã bị khóa', 'ACCOUNT_LOCKED');
  return user;
};

export const authRoutes: Route[] = [
  // ===== API-01 POST /auth/register =====
  {
    method: 'POST',
    path: '/auth/register',
    handler: ({ body }) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const fullName = str(b.fullName).trim();
      const email = str(b.email).trim().toLowerCase();
      const password = str(b.password);
      const confirmPassword = str(b.confirmPassword);

      if (!fullName || !email || !password || !confirmPassword) {
        throw new MockHttpError(400, 'Vui lòng nhập đầy đủ thông tin', 'VALIDATION_ERROR');
      }
      if (fullName.length < RULES.FULL_NAME_MIN || fullName.length > RULES.FULL_NAME_MAX) {
        throw new MockHttpError(400, MESSAGES.fullName, 'VALIDATION_ERROR', [{ field: 'fullName', message: MESSAGES.fullName }]);
      }
      if (!EMAIL_REGEX.test(email) || email.length > RULES.EMAIL_MAX) {
        throw new MockHttpError(400, MESSAGES.emailInvalid, 'VALIDATION_ERROR', [{ field: 'email', message: MESSAGES.emailInvalid }]);
      }
      if (password.length < RULES.PASSWORD_MIN) {
        throw new MockHttpError(400, MESSAGES.passwordWeak, 'VALIDATION_ERROR', [{ field: 'password', message: MESSAGES.passwordWeak }]);
      }
      if (password !== confirmPassword) {
        throw new MockHttpError(400, MESSAGES.confirmMismatch, 'VALIDATION_ERROR', [{ field: 'confirmPassword', message: MESSAGES.confirmMismatch }]);
      }
      if (findUserByEmail(email)) throw new MockHttpError(409, MESSAGES.emailTaken, 'EMAIL_EXISTS');

      // Role luôn là USER do BE gán; không nhận role từ client; không trả JWT; không trả mật khẩu
      const created = addUser({ fullName, email, password });
      return { status: 201, message: 'Đăng ký tài khoản thành công', data: { id: created.id, fullName, email, role: 'USER' } };
    },
  },

  // ===== API-02 POST /auth/login =====
  {
    method: 'POST',
    path: '/auth/login',
    handler: ({ body }) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const email = str(b.email).trim().toLowerCase();
      const password = str(b.password);
      if (!email || !password) throw new MockHttpError(400, 'Vui lòng nhập email và mật khẩu', 'VALIDATION_ERROR');

      const user = findUserByEmail(email);
      // Không tiết lộ email hay mật khẩu sai
      if (!user || user.password !== password) {
        throw new MockHttpError(401, 'Email hoặc mật khẩu không chính xác', 'INVALID_CREDENTIALS');
      }
      if (!user.isActive) throw new MockHttpError(403, 'Tài khoản đã bị khóa', 'ACCOUNT_LOCKED');

      return {
        message: 'Đăng nhập thành công',
        data: { token: makeToken(user), expiresIn: '1d', user: publicUser(user) },
      };
    },
  },

  // ===== API-03 GET /auth/me =====
  {
    method: 'GET',
    path: '/auth/me',
    handler: ({ token }) => ({ message: 'Lấy thông tin tài khoản thành công', data: publicUser(requireUser(token)) }),
  },

  // ===== API-04 POST /auth/logout =====
  {
    method: 'POST',
    path: '/auth/logout',
    handler: ({ token }) => {
      requireUser(token);
      return { message: 'Đăng xuất thành công', data: null };
    },
  },
];
