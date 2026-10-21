// types/index.ts
// NGUỒN DUY NHẤT cho kiểu dữ liệu FE dùng chung. Đây là kiểu "nội bộ" của FE;
// dữ liệu thô từ BE được chuẩn hóa về các kiểu này trong services/mappers.ts.

export type Role = 'USER' | 'ADMIN';

export interface AuthUser {
  id: number;
  fullName: string;
  email?: string; // API đăng nhập mẫu của MNM không trả email, /auth/me thì có
  role: Role;
  avatarUrl?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface NamedRef {
  id?: number;
  name: string;
}

export interface Book {
  id: number;
  title: string;
  coverUrl: string | null;
  description: string | null; // chỉ có ở API chi tiết
  price: number | null; // null = không bán bản giấy (chỉ e-book)
  stockQuantity: number | null;
  hasEbook: boolean | null;
  hasPhysical: boolean | null;
  authors: NamedRef[];
  categories: NamedRef[];
  publisher: NamedRef | null;
  createdAt: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookListResult {
  items: Book[];
  pagination: Pagination;
}

export type BookSort = 'newest' | 'title_asc' | 'title_desc';

export interface BookQuery {
  search?: string;
  categoryId?: number;
  authorId?: number; // mở rộng từ hợp đồng MNM (C01)
  publisherId?: number; // mở rộng từ hợp đồng MNM (C01)
  hasEbook?: boolean; // mở rộng từ hợp đồng MNM (C01)
  sort?: BookSort;
  page?: number;
  limit?: number;
}

export interface Option {
  id: number;
  name: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export interface StoreInfo {
  address: string;
  hotline: string;
  email: string;
}
