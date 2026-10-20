// services/mocks/mockserver.ts
// "Máy chủ giả": nhận đúng thứ mà api.ts sẽ gửi cho BE thật (method, path, body, token)
// và trả về { status, body } đúng khuôn { success, message, data } của hợp đồng.
// => Service/trang chạy y hệt khi nối BE thật, chỉ đổi VITE_USE_MOCK=false.
//
// Thêm UC mới: tạo handlers/<tên>.ts export mảng Route, rồi thêm vào ROUTES bên dưới.
import { MESSAGES } from '../../config/rules';
import { authRoutes } from './handlers/auth';
import { bookRoutes } from './handlers/books';
import { MockHttpError, delay, flag } from './http';
import { matchRoute } from './router';
import type { Route } from './router';

const ROUTES: Route[] = [...authRoutes, ...bookRoutes];

interface MockRequest {
  method: string;
  path: string; // đã gồm query string, không gồm /api
  body: unknown;
  token: string | null;
}

export async function handleMockRequest(req: MockRequest): Promise<{ status: number; body: unknown }> {
  await delay();

  if (flag('mock_error_500')) return { status: 500, body: { success: false, message: MESSAGES.generic, code: 'INTERNAL_ERROR' } };

  const url = new URL(req.path, 'http://mock.local');
  const matched = matchRoute(ROUTES, req.method, url.pathname);
  if (!matched) return { status: 404, body: { success: false, message: 'Không tìm thấy đường dẫn API', code: 'NOT_FOUND' } };

  try {
    const result = matched.route.handler({ params: matched.params, query: url.searchParams, body: req.body, token: req.token });
    return { status: result.status ?? 200, body: { success: true, message: result.message, data: result.data } };
  } catch (err) {
    if (err instanceof MockHttpError) {
      return { status: err.status, body: { success: false, message: err.message, code: err.code, errors: err.errors } };
    }
    console.error('[mock] lỗi không mong đợi', err);
    return { status: 500, body: { success: false, message: MESSAGES.generic, code: 'INTERNAL_ERROR' } };
  }
}
