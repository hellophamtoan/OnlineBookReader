// services/mocks/mockserver.ts
import { MESSAGES } from '../../config/rules';
import { adminBookRoutes } from './handlers/adminBooks';
import { adminChapterRoutes } from './handlers/adminChapters';
import { adminTaxonomyRoutes } from './handlers/adminTaxonomy';
import { authRoutes } from './handlers/auth';
import { bookRoutes } from './handlers/books';
import { cartRoutes } from './handlers/cart';
import { favoriteRoutes } from './handlers/favorites';
import { libraryRoutes } from './handlers/library';
import { orderRoutes } from './handlers/orders';
import { planRoutes } from './handlers/plans';
import { readingRoutes } from './handlers/reading';
import { storeRoutes } from './handlers/store';
import { userRoutes } from './handlers/users';
import { MockHttpError, delay, flag } from './http';
import { matchRoute } from './router';
import type { Route } from './router';

const ROUTES: Route[] = [
  ...authRoutes,
  ...userRoutes,
  ...bookRoutes,
  ...storeRoutes,
  ...cartRoutes,
  ...orderRoutes,
  ...planRoutes,
  ...readingRoutes,
  ...libraryRoutes,
  ...favoriteRoutes,
  ...adminTaxonomyRoutes,
  ...adminBookRoutes,
  ...adminChapterRoutes,
];

interface MockRequest {
  method: string;
  path: string;
  body: unknown;
  token: string | null;
}

export async function handleMockRequest(req: MockRequest): Promise<{ status: number; body: unknown }> {
  await delay();

  if (flag('mock_error_500')) {
    return { status: 500, body: { success: false, message: MESSAGES.generic, code: 'INTERNAL_ERROR' } };
  }

  const url = new URL(req.path, 'http://mock.local');
  const matched = matchRoute(ROUTES, req.method, url.pathname);
  if (!matched) {
    return { status: 404, body: { success: false, message: 'Không tìm thấy đường dẫn API', code: 'NOT_FOUND' } };
  }

  try {
    const result = matched.route.handler({
      params: matched.params,
      query: url.searchParams,
      body: req.body,
      token: req.token,
    });
    return { status: result.status ?? 200, body: { success: true, message: result.message, data: result.data } };
  } catch (err) {
    if (err instanceof MockHttpError) {
      return {
        status: err.status,
        body: { success: false, message: err.message, code: err.code, errors: err.errors },
      };
    }
    console.error('[mock] lỗi không mong đợi', err);
    return { status: 500, body: { success: false, message: MESSAGES.generic, code: 'INTERNAL_ERROR' } };
  }
}
