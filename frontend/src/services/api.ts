// services/api.ts
// Cổng gọi API DUY NHẤT của FE. Mọi service đều đi qua đây, trang/component không tự fetch.
//
// Chế độ chạy (xem config/env.ts):
//   VITE_USE_MOCK=true  -> request được chuyển cho "máy chủ giả" trong services/mocks (không cần BE)
//   VITE_USE_MOCK=false -> gọi BE thật tại VITE_API_URL
// Hai chế độ dùng CHUNG phần xử lý lỗi/401 bên dưới, nên chuyển sang BE thật không phải sửa service nào.
//
// Backend luôn trả { success, message, data }; lỗi: { success:false, message, code?, errors? }.
import { env } from '../config/env';
import { MESSAGES } from '../config/rules';
import type { FieldError } from '../types';

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';
// Sự kiện phát ra khi token hết hạn / tài khoản bị khóa; AuthContext lắng nghe để đăng xuất
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status: number; // 0 = không kết nối được máy chủ
  code?: string; // EMAIL_EXISTS, INVALID_CREDENTIALS, ACCOUNT_LOCKED... (nếu BE có gửi)
  errors: FieldError[]; // lỗi theo từng ô nhập (nếu BE có gửi)

  constructor(message: string, status: number, code?: string, errors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  fieldMessage(field: string) {
    return this.errors.find((e) => e.field === field)?.message;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Query = Record<string, string | number | boolean | null | undefined>;
interface RawResponse {
  status: number;
  body: unknown;
}

export const buildQuery = (params?: Query) => {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

async function transport(method: Method, path: string, body: unknown, token: string | null): Promise<RawResponse> {
  if (env.USE_MOCK) {
    const { handleMockRequest } = await import('./mocks/mockserver');
    return handleMockRequest({ method, path, body, token });
  }

  let res: Response;
  try {
    res = await fetch(`${env.API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Mất mạng, server chưa chạy hoặc bị chặn CORS
    throw new ApiError(MESSAGES.network, 0);
  }

  // Phản hồi có thể rỗng / không phải JSON (lỗi proxy, 204...) nên không gọi res.json() thẳng
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

const toFieldErrors = (raw: unknown): FieldError[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e): FieldError[] => {
    if (typeof e === 'string') return [{ field: '', message: e }];
    if (e && typeof e === 'object' && 'message' in e) {
      const o = e as { field?: unknown; param?: unknown; message: unknown };
      return [{ field: String(o.field ?? o.param ?? ''), message: String(o.message) }];
    }
    return [];
  });
};

async function request<T>(method: Method, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const token = localStorage.getItem(TOKEN_KEY);
  const { status, body: parsed } = await transport(method, path, body, token);
  const json = (parsed && typeof parsed === 'object' ? parsed : null) as
    | (Partial<ApiResponse<T>> & { code?: string; errors?: unknown })
    | null;

  if (status < 200 || status >= 300) {
    const locked = status === 403 && (json?.code === 'ACCOUNT_LOCKED' || /bị khóa/i.test(json?.message ?? ''));
    // Chỉ tự đăng xuất khi ĐÃ gửi token; đăng nhập sai mật khẩu (401) thì không
    if (token && (status === 401 || locked)) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(json?.message || MESSAGES.generic, status, json?.code, toFieldErrors(json?.errors));
  }

  return (json ?? { success: true, message: '', data: null }) as ApiResponse<T>;
}

export const api = {
  get: <T = unknown>(path: string, params?: Query) => request<T>('GET', `${path}${buildQuery(params)}`),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};
