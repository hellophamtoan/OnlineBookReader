// config/rules.ts
// Hằng số nghiệp vụ + thông báo dùng chung. Đổi quy tắc (vd. độ dài mật khẩu) chỉ sửa ở đây.
import type { BookSort } from '../types';

export const BRAND_NAME = 'Nhà sách Nhóm 14';

// Thông tin liên hệ hiển thị ở chân trang. Đây là giá trị DỰ PHÒNG: có backend (GET /store-info) thì lấy từ backend,
// backend chưa có hoặc lỗi thì dùng các giá trị này; mock server cũng trả đúng các giá trị này. Đổi thành thông tin thật của nhóm.
export const STORE_INFO = {
  address: 'Số 3 phố Cầu Giấy, phường Láng Thượng, quận Đống Đa, Hà Nội',
  hotline: '1900 1234',
  email: 'lienhe@nhasach14.local',
};

export const RULES = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 100,
  EMAIL_MAX: 100,
  PASSWORD_MIN: 8, // chỉ tối thiểu 8 ký tự; không bắt buộc chữ hoa/số/ký tự đặc biệt
  SEARCH_MAX: 100,
  // UC004 - thông tin nhận hàng (Bảng 20 báo cáo / mục 5 "Quy ước" của hợp đồng)
  RECEIVER_NAME_MIN: 2,
  RECEIVER_NAME_MAX: 100,
  PHONE_REGEX: /^0\d{9}$/, // 10 chữ số, bắt đầu bằng 0
  ADDRESS_MIN: 10,
  ADDRESS_MAX: 255,
  NOTE_MAX: 255,
} as const;

export const MESSAGES = {
  fullName: `Vui lòng nhập họ tên (${RULES.FULL_NAME_MIN}–${RULES.FULL_NAME_MAX} ký tự)`,
  emailRequired: 'Vui lòng nhập email',
  emailInvalid: 'Email không hợp lệ',
  emailTaken: 'Email không hợp lệ hoặc đã được đăng ký',
  passwordRequired: 'Vui lòng nhập mật khẩu',
  passwordWeak: `Mật khẩu tối thiểu ${RULES.PASSWORD_MIN} ký tự`,
  confirmRequired: 'Vui lòng nhập lại mật khẩu',
  confirmMismatch: 'Mật khẩu xác nhận không khớp',
  generic: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
  network: 'Không thể kết nối đến máy chủ',
  // UC004
  receiverName: `Vui lòng nhập họ tên người nhận (${RULES.RECEIVER_NAME_MIN}–${RULES.RECEIVER_NAME_MAX} ký tự)`,
  phoneRequired: 'Vui lòng nhập số điện thoại người nhận',
  phoneInvalid: 'Số điện thoại không hợp lệ',
  addressInvalid: 'Vui lòng nhập địa chỉ giao hàng đầy đủ',
  noteTooLong: `Ghi chú tối đa ${RULES.NOTE_MAX} ký tự`,
  paymentRequired: 'Vui lòng chọn hình thức thanh toán',
  quantityInvalid: 'Số lượng không hợp lệ hoặc vượt tồn kho',
} as const;

export const AUTH = {
  // API-04: khi nối BE thật nên gọi POST /auth/logout. Mock vẫn hỗ trợ.
  // Mặc định true để khớp hợp đồng; tắt bằng VITE_LOGOUT_CALLS_SERVER=false nếu BE chưa implement.
  LOGOUT_CALLS_SERVER:
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOGOUT_CALLS_SERVER !== undefined
      ? String(import.meta.env.VITE_LOGOUT_CALLS_SERVER).trim().toLowerCase() === 'true'
      : true,
  REDIRECT_DELAY_MS: 1200,
} as const;

export const PAGINATION = {
  BOOKS_PER_PAGE: 12, // mặc định của hợp đồng (D-07)
  HOME_SECTION_SIZE: 8,
  ORDERS_PER_PAGE: 12, // O02: mặc định 12, tối đa 50
} as const;

// Sort đã chốt trong hợp đồng UC001–UC003
export const BOOK_SORTS: { value: BookSort; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'title_asc', label: 'Tên A → Z' },
  { value: 'title_desc', label: 'Tên Z → A' },
];
