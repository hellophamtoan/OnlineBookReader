// types/admin.ts - kiểu dữ liệu khu quản trị. UC007 hiện tại; UC008-UC011 thêm kiểu mới vào file riêng cùng cách làm.
import type { Pagination } from './index';

export type EntityStatus = 'active' | 'inactive';

// ---------- Thể loại / Tác giả / NXB (API-14 .. API-25) ----------
export type TaxonomyKind = 'categories' | 'authors' | 'publishers';

export interface TaxonomyItem {
  id: number;
  name: string;
  status: EntityStatus;
  bio?: string | null; // chỉ tác giả có
}

export interface TaxonomyQuery {
  status?: EntityStatus;
  search?: string;
}

export interface TaxonomyPayload {
  name: string;
  bio?: string; // chỉ tác giả
  status?: EntityStatus; // chỉ khi sửa
}

// ---------- Sách (API-26 .. API-30) ----------
export interface AdminBookListItem {
  id: number;
  title: string;
  coverUrl: string | null;
  hasPhysical: boolean;
  hasEbook: boolean;
  price: number | null;
  stock: number;
  status: EntityStatus;
  createdAt: string | null;
  chapterCount: number;
}

export interface AdminBookListResult {
  items: AdminBookListItem[];
  pagination: Pagination;
}

export interface AdminBookQuery {
  search?: string;
  status?: EntityStatus;
  page?: number;
  limit?: number;
}

export interface AdminBookDetail {
  id: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  publisherId: number | null;
  hasPhysical: boolean;
  hasEbook: boolean;
  price: number | null;
  stock: number;
  status: EntityStatus;
  createdAt: string | null;
  updatedAt: string | null;
  authors: TaxonomyItem[];
  categories: TaxonomyItem[];
}

// Body của API-28 / API-29
export interface AdminBookPayload {
  title: string;
  description?: string;
  coverUrl?: string | null;
  publisherId?: number | null;
  hasPhysical: boolean;
  hasEbook: boolean;
  price: number | null;
  stock: number;
  authorIds: number[];
  categoryIds: number[];
  status?: EntityStatus; // chỉ khi sửa
}

// ---------- Chương e-book (API-31 .. API-35) ----------
export interface AdminChapter {
  id: number;
  bookId: number;
  chapterNumber: number;
  title: string;
  content: string;
}

export interface AdminChapterPayload {
  chapterNumber: number;
  title: string;
  content: string;
}

export interface AdminChapterSaved {
  id: number;
  bookId: number;
  chapterNumber: number;
  title: string;
}

/** Kết quả phân tích EPUB trước khi tạo sách */
export interface EpubParsedChapter {
  /** Số chương hiển thị (1..n); 0 = không tính chương (hiện —) */
  chapterNumber: number;
  title: string;
  content: string;
  textLength?: number;
  /** false = phần phụ, không đánh số chương; mặc định true */
  countsAsChapter?: boolean;
}

export interface EpubParseResult {
  title: string;
  description: string;
  /** Tên tác giả từ dc:creator */
  authors: string[];
  /** Tên NXB từ dc:publisher */
  publishers: string[];
  /** Chủ đề / thể loại gợi ý từ dc:subject */
  subjects: string[];
  /** data:image/... nếu có ảnh bìa; null nếu không */
  coverUrl: string | null;
  illustrationCount: number;
  tocTitles: string[];
  chapterCount: number;
  chapters: EpubParsedChapter[];
  skipped: { title: string; reason: string | null }[];
}
