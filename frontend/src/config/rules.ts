// config/rules.ts
// Hằng số nghiệp vụ + thông báo dùng chung. Đổi quy tắc (vd. độ dài mật khẩu) chỉ sửa ở đây.
import type { BookSort } from '../types';

export const BRAND_NAME = 'Nhà sách Nhóm 14';

export const RULES = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 100,
  EMAIL_MAX: 100,
  PASSWORD_MIN: 8, // quyết định D-02: tối thiểu 8 ký tự; Bảng 20 báo cáo: gồm cả chữ và số
  SEARCH_MAX: 100,
} as const;

export const MESSAGES = {
  fullName: `Vui lòng nhập họ tên (${RULES.FULL_NAME_MIN}–${RULES.FULL_NAME_MAX} ký tự)`,
  emailRequired: 'Vui lòng nhập email',
  emailInvalid: 'Email không hợp lệ',
  emailTaken: 'Email không hợp lệ hoặc đã được đăng ký',
  passwordRequired: 'Vui lòng nhập mật khẩu',
  passwordWeak: `Mật khẩu tối thiểu ${RULES.PASSWORD_MIN} ký tự gồm chữ và số`,
  confirmRequired: 'Vui lòng nhập lại mật khẩu',
  confirmMismatch: 'Mật khẩu xác nhận không khớp',
  generic: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
  network: 'Không thể kết nối đến máy chủ',
} as const;

export const AUTH = {
  // Quyết định D-04 / D9: đăng xuất chỉ xóa token ở client. Đổi true nếu BE làm POST /auth/logout.
  LOGOUT_CALLS_SERVER: false,
  REDIRECT_DELAY_MS: 1200,
} as const;

export const PAGINATION = {
  BOOKS_PER_PAGE: 12, // mặc định của hợp đồng (D-07)
  HOME_SECTION_SIZE: 8,
} as const;

// Sort đã chốt trong hợp đồng UC001–UC003
export const BOOK_SORTS: { value: BookSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'title_asc', label: 'Tên A → Z' },
  { value: 'title_desc', label: 'Tên Z → A' },
];
