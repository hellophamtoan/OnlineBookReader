// services/api.ts
// Nơi tập trung gọi API backend, tránh mỗi page tự hard-code URL riêng.
// Backend luôn trả { success, message, data }.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';
// Sự kiện phát ra khi token hết hạn/không hợp lệ; AuthContext lắng nghe để đăng xuất
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = localStorage.getItem(TOKEN_KEY);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    // Mất mạng hoặc server chưa chạy
    throw new ApiError('Không thể kết nối đến máy chủ', 0);
  }

  // Phản hồi có thể rỗng hoặc không phải JSON (lỗi proxy, 204...) nên không gọi res.json() thẳng
  let body: Partial<ApiResponse<T>> | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    // Chỉ tự đăng xuất khi ĐÃ gửi token; đăng nhập sai mật khẩu (401) thì không
    if (res.status === 401 && token) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(body?.message || 'Đã có lỗi xảy ra', res.status);
  }

  return (body ?? { success: true, message: '', data: null }) as ApiResponse<T>;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
};
