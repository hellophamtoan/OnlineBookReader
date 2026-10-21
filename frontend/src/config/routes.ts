// config/routes.ts
// Mọi đường dẫn của FE nằm ở đây. Thêm UC mới thì thêm dòng vào ROUTES, đừng viết cứng '/xxx' trong component.
import type { Role } from '../types';

export const ROUTES = {
  HOME: '/',
  BOOKS: '/books',
  BOOK_DETAIL: (id: number | string) => `/books/${id}`,
  LOGIN: '/login',
  REGISTER: '/register',
  // TODO UC004+: CART, CHECKOUT, MY_ORDERS...  | UC005: PLANS  | UC006: READER  | UC007+: ADMIN
  ADMIN_HOME: '/', // TODO: đổi thành '/admin' khi có trang quản trị
} as const;

// Pattern dùng cho <Route path=...>
export const ROUTE_PATTERNS = {
  BOOK_DETAIL: '/books/:id',
} as const;

// UC002 bước A5: Người dùng -> trang chủ, Admin -> trang quản trị
export const homeFor = (role: Role) => (role === 'ADMIN' ? ROUTES.ADMIN_HOME : ROUTES.HOME);
