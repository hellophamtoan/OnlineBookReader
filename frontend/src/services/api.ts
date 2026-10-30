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

// A retry after a network timeout must use the same UUID; a completed transaction
// removes the key, so an intentional second purchase gets a new UUID.
const transactionPaths = [
  /^\/orders$/, /^\/subscriptions$/, /^\/admin\/users\/\d+\/wallet\/topup$/,
];
const keyFor = (method: Method, path: string, body: unknown): { key: string; storageKey: string } | null => {
  if (method !== 'POST' || !transactionPaths.some((p) => p.test(path))) return null;
  const payload = JSON.stringify([path, body]);
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) hash = Math.imul(hash ^ payload.charCodeAt(i), 16777619);
  const storageKey = `obr:tx:${path}:${hash >>> 0}`;
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) {
      const stored = JSON.parse(existing) as { payload: string; key: string };
      if (stored.payload === payload) return { storageKey, key: stored.key };
    }
    const key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, JSON.stringify({ payload, key }));
    return { storageKey, key };
  } catch {
    return { storageKey, key: crypto.randomUUID() };
  }
};

async function transport(method: Method, path: string, body: unknown, token: string | null, transactionKey?: string): Promise<RawResponse> {
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
        ...(transactionKey ? { 'Idempotency-Key': transactionKey } : {}),
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
  const tx = env.USE_MOCK ? null : keyFor(method, path, body);
  let response: RawResponse;
  try {
    response = await transport(method, path, body, token, tx?.key);
  } catch (err) {
    // Keep UUID in sessionStorage: retry may already have been committed on server.
    throw err;
  }
  const { status, body: parsed } = response;
  const json = (parsed && typeof parsed === 'object' ? parsed : null) as
    | (Partial<ApiResponse<T>> & { code?: string; errors?: unknown })
    | null;

  // Một số BE trả HTTP 200 kèm success:false — vẫn coi là lỗi nghiệp vụ
  const businessFail = json && json.success === false;
  if (status < 200 || status >= 300 || businessFail) {
    const locked = status === 403 && (json?.code === 'ACCOUNT_LOCKED' || /bị khóa/i.test(json?.message ?? ''));
    // Chỉ tự đăng xuất khi ĐÃ gửi token; đăng nhập sai mật khẩu (401) thì không
    if (token && (status === 401 || locked)) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    // Transaction definitely rejected on 4xx: allow a corrected request to get a new UUID.
    if (tx && (businessFail || (status >= 400 && status < 500))) {
      try { sessionStorage.removeItem(tx.storageKey); } catch { /* browser privacy mode */ }
    }
    throw new ApiError(
      json?.message || MESSAGES.generic,
      status >= 200 && status < 300 && businessFail ? 400 : status,
      json?.code,
      toFieldErrors(json?.errors),
    );
  }

  if (tx) {
    try { sessionStorage.removeItem(tx.storageKey); } catch { /* browser privacy mode */ }
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
