// config/admin.ts
// Cấu hình khu quản trị. Thêm UC quản trị mới (UC008-UC011) = thêm 1 mục vào ADMIN_NAV_GROUPS, không phải sửa AdminLayout.
import type { EntityStatus, TaxonomyKind } from '../types';
import { ROUTES } from './routes';

export const ADMIN = {
  PAGE_SIZE: 20, // API-26: mặc định 20, tối đa 100
  LOW_STOCK: 5,
  NAME_MAX: 150, // thể loại / tác giả / NXB (API-15, 19, 23)
  TITLE_MAX: 255, // tên sách, tên chương
  CONTENT_MAX: 2_000_000, // nội dung chương (API-32)
  COVER_MAX: 2_500_000, // data URL từ EPUB / máy
  COVER_ACCEPT: 'image/jpeg,image/png,image/gif,image/webp',
  COVER_MAX_BYTES: 2 * 1024 * 1024,
} as const;

export interface AdminNavItem {
  to: string;
  label: string;
  end?: boolean;
  desc?: string; // hiện ở thẻ trên trang Tổng quan
}
export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { title: 'Tổng quan', items: [{ to: ROUTES.ADMIN_HOME, label: 'Tổng quan', end: true }] },
  {
    title: 'Danh mục & kho sách', // UC007
    items: [
      { to: ROUTES.ADMIN_BOOKS, label: 'Sách & kho', desc: 'Sách giấy, e-book, tồn kho và các chương' },
      { to: ROUTES.ADMIN_CATEGORIES, label: 'Thể loại', desc: 'Nhóm sách theo thể loại' },
      { to: ROUTES.ADMIN_AUTHORS, label: 'Tác giả', desc: 'Danh sách tác giả' },
      { to: ROUTES.ADMIN_PUBLISHERS, label: 'Nhà xuất bản', desc: 'Danh sách nhà xuất bản' },
    ],
  },
  {
    title: 'Gói & ví test',
    items: [
      { to: ROUTES.ADMIN_PLANS, label: 'Gói đọc', desc: 'UC008 — tạo / ngừng bán gói' },
      { to: ROUTES.ADMIN_PLANS, label: 'Nạp ví (test)', desc: 'UC013 — nạp ví môi trường học tập' },
    ],
  },
  // TODO UC009: Đơn hàng  |  UC010: Người dùng  |  UC011: Báo cáo
];

export const STATUS_LABELS: Record<EntityStatus, string> = { active: 'Đang hoạt động', inactive: 'Ngừng hoạt động' };

// Ba danh mục dùng chung một trang quản lý, khác nhau ở cấu hình này
export interface TaxonomyConfig {
  kind: TaxonomyKind;
  title: string; // tiêu đề trang
  singular: string; // "thể loại" (dùng trong câu thông báo)
  hasBio: boolean;
  placeholder: string;
}

export const TAXONOMY: Record<TaxonomyKind, TaxonomyConfig> = {
  categories: { kind: 'categories', title: 'Quản lý thể loại', singular: 'thể loại', hasBio: false, placeholder: 'Ví dụ: Tản văn' },
  authors: { kind: 'authors', title: 'Quản lý tác giả', singular: 'tác giả', hasBio: true, placeholder: 'Ví dụ: Nguyễn Nhật Ánh' },
  publishers: { kind: 'publishers', title: 'Quản lý nhà xuất bản', singular: 'nhà xuất bản', hasBio: false, placeholder: 'Ví dụ: NXB Kim Đồng' },
};

export const ADMIN_MESSAGES = {
  nameRequired: 'Vui lòng nhập tên',
  nameTooLong: `Tên tối đa ${ADMIN.NAME_MAX} ký tự`,
  titleRequired: 'Vui lòng nhập tiêu đề',
  titleTooLong: `Tối đa ${ADMIN.TITLE_MAX} ký tự`,
  coverInvalid: 'Ảnh bìa phải là URL http(s), /uploads/... hoặc ảnh lấy từ EPUB/máy (JPEG/PNG/GIF/WebP)',
  coverType: 'Chỉ chấp nhận ảnh JPEG, PNG, GIF hoặc WebP',
  coverSize: 'Dung lượng ảnh bìa tối đa 2MB',
  formatRequired: 'Chọn ít nhất một hình thức: sách giấy hoặc e-book',
  priceInvalid: 'Giá phải là số không âm',
  stockInvalid: 'Tồn kho phải là số nguyên không âm',
  publisherRequired: 'Chọn nhà xuất bản',
  authorRequired: 'Chọn ít nhất một tác giả',
  categoryRequired: 'Chọn ít nhất một thể loại',
  chapterNumberInvalid: 'Số chương phải là số nguyên dương',
  contentRequired: 'Vui lòng nhập nội dung chương',
  contentTooLong: `Nội dung tối đa ${ADMIN.CONTENT_MAX.toLocaleString('vi-VN')} ký tự`,
} as const;
