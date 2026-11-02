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

// ---------- UC004: giỏ hàng, đơn hàng ----------
export type OrderStatus = 'PENDING' | 'PREPARING' | 'SHIPPING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
export type PaymentMethod = 'COD' | 'WALLET';

export interface CartItem {
  bookId: number;
  title: string;
  coverUrl: string | null;
  unitPrice: number;
  quantity: number;
  stockQuantity: number;
  available: boolean;
  /** OUT_OF_STOCK | INACTIVE | NOT_PHYSICAL | OK */
  statusReason?: string;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  canCheckout?: boolean;
}

export interface OrderItem {
  bookId: number;
  title: string;
  quantity: number;
  unitPrice: number; // đơn giá đã chốt tại thời điểm đặt
  subtotal: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  receiverName: string;
  receiverPhone: string;
  shippingAddress: string;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  items: OrderItem[];
}

export interface OrderListResult {
  items: Order[];
  pagination: Pagination;
}

export interface OrderQuery {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

// Body của O01 POST /orders
export interface CheckoutPayload {
  receiverName: string;
  receiverPhone: string;
  shippingAddress: string;
  paymentMethod: PaymentMethod;
  note: string;
  /** Chỉ đặt các dòng này (chọn từ giỏ hoặc Mua ngay). Không gửi = cả giỏ. */
  items?: { bookId: number; quantity: number }[];
}

// API-08 GET /users/me (UC004 dùng điền sẵn + số dư ví; UC012 xem/sửa hồ sơ)
export interface UserProfile {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  address: string | null; // không có trong API-08; chỉ dùng điền sẵn địa chỉ ở trang đặt hàng nếu BE có gửi
  avatarUrl: string | null; // UC012
  role: Role; // UC012
  createdAt: string | null; // UC012
  walletBalance: number;
}

// ---------- Kiểu theo nhóm chức năng: mỗi nhóm một file, thêm UC mới thì thêm một dòng ở đây ----------
export * from './reader'; // UC006
export * from './admin'; // UC007+
