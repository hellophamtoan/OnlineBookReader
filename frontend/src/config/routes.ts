// config/routes.ts
// Mọi đường dẫn của FE nằm ở đây. Thêm UC mới thì thêm dòng vào ROUTES, đừng viết cứng '/xxx' trong component.
import type { Role } from '../types';

export const ROUTES = {
  HOME: '/',
  BOOKS: '/books',
  BOOK_DETAIL: (id: number | string) => `/books/${id}`,
  LOGIN: '/login',
  REGISTER: '/register',
  // UC006 - Đọc sách trực tuyến
  READER: (bookId: number | string, chapter?: number | string) =>
    chapter === undefined ? `/read/${bookId}` : `/read/${bookId}?chapter=${chapter}`,
  // UC012 - Thông tin cá nhân
  PROFILE: '/profile',
  LIBRARY: '/library',
  
  // Đơn hàng & Thanh toán & Gói cước
  ORDERS: '/orders',
  MY_ORDERS: '/orders', // 👈 Thêm alias này vì OrderDetailPage đang gọi ROUTES.MY_ORDERS
  ORDER_DETAIL: (id: number | string) => `/orders/${id}`,
  CART: '/cart',             // 👈 Thêm cho CartPage / CheckoutPage
  CHECKOUT: '/checkout',     // 👈 Thêm cho trang thanh toán
  PLANS: '/plans',           // 👈 Thêm cho SubscriptionRequired

  // UC007+ - Khu quản trị
  ADMIN_HOME: '/admin',
  ADMIN_PROFILE: '/admin/profile',
  ADMIN_BOOKS: '/admin/books',
  ADMIN_BOOK_NEW: '/admin/books/new',
  ADMIN_BOOK_DETAIL: (id: number | string) => `/admin/books/${id}`,
  ADMIN_BOOK_EDIT: (id: number | string) => `/admin/books/${id}/edit`,
  ADMIN_BOOK_CHAPTERS: (bookId: number | string) => `/admin/books/${bookId}/chapters`,
  ADMIN_CHAPTER_NEW: (bookId: number | string) => `/admin/books/${bookId}/chapters/new`,
  ADMIN_CHAPTER_EDIT: (bookId: number | string, chapterId: number | string) =>
    `/admin/books/${bookId}/chapters/${chapterId}/edit`,
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_AUTHORS: '/admin/authors',
  ADMIN_PUBLISHERS: '/admin/publishers',
  ADMIN_PLANS: '/admin/plans',
} as const;

export const ROUTE_PATTERNS = {
  BOOK_DETAIL: '/books/:id',
  READER: '/read/:bookId',
  ORDER_DETAIL: '/orders/:id',
  ADMIN_BOOK_DETAIL: '/admin/books/:id',
  ADMIN_BOOK_EDIT: '/admin/books/:id/edit',
  ADMIN_BOOK_CHAPTERS: '/admin/books/:id/chapters',
  ADMIN_CHAPTER_NEW: '/admin/books/:bookId/chapters/new',
  ADMIN_CHAPTER_EDIT: '/admin/books/:bookId/chapters/:chapterId/edit',
} as const;

/** Sau đăng nhập: vào trang chủ bán sách (cả USER và ADMIN). Admin vào quản trị qua menu. */
export const homeFor = (_role: Role) => ROUTES.HOME;

export const profileFor = (role: Role) => (role === 'ADMIN' ? ROUTES.ADMIN_PROFILE : ROUTES.PROFILE);