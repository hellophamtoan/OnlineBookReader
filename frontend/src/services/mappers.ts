// services/mappers.ts
// Chuẩn hóa dữ liệu thô của BE về kiểu nội bộ của FE (types/index.ts).
//
// BE UC001–UC003 đã chốt: coverUrl, authorNames/authors, page/limit/total phẳng, register/me data phẳng, login có user.
// Mapper vẫn đọc thêm vài alias (coverImage, data.book, pagination object…) để tương thích mock / response lệch cũ
// — UI không phụ thuộc alias; có thể gỡ dần khi mock khớp BE 100%.
import { env } from '../config/env';
import { mergeClientCover } from '../utils/clientCoverStore';
import type {
  AuthUser, Book, BookListResult, Cart, CartItem, NamedRef, Option, Order, OrderItem, OrderListResult, OrderStatus,
  Pagination, PaymentMethod, Role, StoreInfo, UserProfile,
} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = Record<string, any>;

// [Xử lý] Kiểm tra giá trị là object.
export const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

// [Xử lý] Đổi sang số an toàn.
// MySQL DECIMAL thường trả về chuỗi "79000.00" -> ép về số
export const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

// [Xử lý] Đổi sang true/false an toàn.
export const bool = (v: unknown): boolean | null => {
  if (v === null || v === undefined) return null;
  return v === true || v === 1 || v === '1' || v === 'true';
};

// [Xử lý] Ghép đường dẫn ảnh /uploads/... với địa chỉ backend để hiển thị.
// "/uploads/covers/a.jpg" -> "http://localhost:5000/uploads/covers/a.jpg"
export const resolveAssetUrl = (url?: unknown): string | null => {
  if (typeof url !== 'string' || !url) return null;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  return `${env.ASSET_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

// [Xử lý] Chuẩn hóa một tác giả/thể loại/NXB.
const toRef = (v: unknown): NamedRef | null => {
  if (typeof v === 'string') return { name: v };
  if (isObj(v) && typeof v.name === 'string') return { id: num(v.id) ?? undefined, name: v.name };
  return null;
};

// [Xử lý] Chuẩn hóa danh sách tác giả/thể loại.
const toRefs = (list: unknown, single: unknown, names: unknown): NamedRef[] => {
  const source = Array.isArray(list) ? list : single ? [single] : Array.isArray(names) ? names : [];
  return source.map(toRef).filter((r): r is NamedRef => r !== null);
};

// [Xử lý] Chuẩn hóa dữ liệu người dùng đăng nhập (tên, vai trò, ảnh).
export const mapUser = (raw: unknown): AuthUser => {
  const r: Raw = isObj(raw) ? raw : {};
  const role: Role = r.role === 'ADMIN' ? 'ADMIN' : 'USER';
  return {
    id: Number(r.id),
    fullName: String(r.fullName ?? r.full_name ?? ''),
    email: typeof r.email === 'string' ? r.email : undefined,
    role,
    avatarUrl: resolveAssetUrl(r.avatarUrl ?? r.avatar),
  };
};

// [Xử lý] Chuẩn hóa một sách cho thẻ sách.
export const mapBook = (raw: unknown): Book => {
  const r: Raw = isObj(raw) ? raw : {};
  const publisher = toRef(r.publisher ?? (r.publisherName ? r.publisherName : null));
  const id = Number(r.id);
  return {
    id,
    title: String(r.title ?? ''),
    coverUrl: mergeClientCover(id, resolveAssetUrl(r.coverUrl ?? r.coverImage)),
    description: typeof r.description === 'string' ? r.description : null,
    price: num(r.price),
    stockQuantity: num(r.stockQuantity ?? r.stock),
    hasEbook: bool(r.hasEbook),
    hasPhysical: bool(r.hasPhysical),
    authors: toRefs(r.authors, r.author, r.authorNames),
    categories: toRefs(r.categories, r.category, r.categoryNames),
    publisher,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
  };
};

// [Xử lý] Chuẩn hóa thông tin phân trang.
export const mapPagination = (data: Raw, itemCount: number): Pagination => {
  const p: Raw = isObj(data.pagination) ? data.pagination : data;
  const limit = num(p.limit) ?? (itemCount || 12);
  const total = num(p.total) ?? itemCount;
  return {
    page: num(p.page) ?? 1,
    limit,
    total,
    totalPages: num(p.totalPages) ?? Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
};

// [Xử lý] Chuẩn hóa danh sách sách.
export const mapBookList = (data: unknown): BookListResult => {
  const d: Raw = isObj(data) ? data : {};
  const items = Array.isArray(d.items) ? d.items.map(mapBook) : [];
  return { items, pagination: mapPagination(d, items.length) };
};

// [Xử lý] Chuẩn hóa chi tiết sách.
// Chi tiết sách: data có thể là sách trực tiếp hoặc { book }
export const mapBookDetail = (data: unknown): Book => mapBook(isObj(data) && isObj(data.book) ? data.book : data);

// [Xử lý] Chuẩn hóa danh sách lựa chọn cho bộ lọc.
// API-07: data = { items: [{ id, name }] }. Một số BE trả mảng thẳng — chấp nhận cả hai.
export const mapOptions = (data: unknown): Option[] => {
  const items = Array.isArray(data)
    ? data
    : isObj(data) && Array.isArray(data.items)
      ? data.items
      : [];
  return items.flatMap((i: unknown) =>
    isObj(i) && typeof i.name === 'string' ? [{ id: Number(i.id), name: i.name }] : [],
  );
};

// [Xử lý] Chuẩn hóa thông tin cửa hàng.
// Thông tin cửa hàng: nhận data trực tiếp hoặc { store }; thiếu trường nào thì dùng giá trị dự phòng
export const mapStoreInfo = (data: unknown, fallback: StoreInfo): StoreInfo => {
  const d: Raw = isObj(data) && isObj(data.store) ? data.store : isObj(data) ? data : {};
  const pick = (...values: unknown[]) => {
    const v = values.find((x) => typeof x === 'string' && x.trim() !== '');
    return typeof v === 'string' ? v.trim() : '';
  };
  return {
    address: pick(d.address, d.storeAddress) || fallback.address,
    hotline: pick(d.hotline, d.phone) || fallback.hotline,
    email: pick(d.email, d.contactEmail) || fallback.email,
  };
};

// ---------- UC004: giỏ hàng, đơn hàng, hồ sơ ----------
// Dạng chung của hợp đồng MNM: giỏ -> data { items, totalAmount }; đơn -> data { order }; danh sách đơn -> data { items, pagination }.

// [Xử lý] Chuẩn hóa một dòng giỏ hàng.
export const mapCartItem = (raw: unknown): CartItem => {
  const r: Raw = isObj(raw) ? raw : {};
  const unitPrice = num(r.unitPrice ?? r.price) ?? 0;
  const quantity = num(r.quantity) ?? 0;
  const stockQuantity = num(r.stockQuantity ?? r.stock) ?? 0;
  return {
    bookId: Number(r.bookId ?? r.id),
    title: String(r.title ?? ''),
    coverUrl: resolveAssetUrl(r.coverImage ?? r.coverUrl),
    unitPrice,
    quantity,
    stockQuantity,
    available: bool(r.available) ?? stockQuantity > 0,
    statusReason: r.statusReason != null ? String(r.statusReason) : undefined,
    subtotal: num(r.subtotal) ?? unitPrice * quantity,
  };
};

// [Xử lý] Chuẩn hóa giỏ hàng.
export const mapCart = (data: unknown): Cart => {
  const d: Raw = isObj(data) ? data : {};
  const items = Array.isArray(d.items) ? d.items.map(mapCartItem) : [];
  const totalAmount = num(d.totalAmount) ?? items.reduce((sum, i) => sum + i.subtotal, 0);
  const canCheckout =
    bool(d.canCheckout) ?? (items.length > 0 && items.every((i) => i.available));
  return { items, totalAmount, canCheckout };
};

// [Xử lý] Chuẩn hóa một sách trong đơn.
const mapOrderItem = (raw: unknown): OrderItem => {
  const r: Raw = isObj(raw) ? raw : {};
  const unitPrice = num(r.unitPrice) ?? 0;
  const quantity = num(r.quantity) ?? 0;
  return {
    bookId: Number(r.bookId),
    title: String(r.title ?? r.bookTitle ?? ''),
    quantity,
    unitPrice,
    subtotal: num(r.subtotal) ?? unitPrice * quantity,
  };
};

// [Xử lý] Chuẩn hóa một đơn hàng.
export const mapOrder = (raw: unknown): Order => {
  const r: Raw = isObj(raw) ? raw : {};
  const items = Array.isArray(r.items) ? r.items.map(mapOrderItem) : [];
  return {
    id: Number(r.id),
    status: (() => {
      const s = String(r.status ?? 'PENDING').toUpperCase();
      // BE thật dùng CONFIRMED; FE/mock hiển thị PREPARING («Đang chuẩn bị»)
      return (s === 'CONFIRMED' ? 'PREPARING' : s) as OrderStatus;
    })(),
    paymentMethod: String(r.paymentMethod ?? 'COD').toUpperCase() as PaymentMethod,
    totalAmount: num(r.totalAmount) ?? items.reduce((sum, i) => sum + i.subtotal, 0),
    receiverName: String(r.receiverName ?? ''),
    receiverPhone: String(r.receiverPhone ?? ''),
    shippingAddress: String(r.shippingAddress ?? ''),
    note: typeof r.note === 'string' && r.note !== '' ? r.note : null,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : null,
    items,
  };
};

// [Xử lý] Chuẩn hóa chi tiết đơn hàng.
// Một đơn: data có thể là đơn trực tiếp hoặc { order }
export const mapOrderDetail = (data: unknown): Order => mapOrder(isObj(data) && isObj(data.order) ? data.order : data);

// [Xử lý] Chuẩn hóa danh sách đơn hàng.
export const mapOrderList = (data: unknown): OrderListResult => {
  const d: Raw = isObj(data) ? data : {};
  const items = Array.isArray(d.items) ? d.items.map(mapOrder) : [];
  return { items, pagination: mapPagination(d, items.length) };
};

// [Xử lý] Chuẩn hóa hồ sơ cá nhân.
export const mapProfile = (data: unknown): UserProfile => {
  const r: Raw = isObj(data) && isObj(data.user) ? data.user : isObj(data) ? data : {};
  return {
    id: Number(r.id),
    fullName: String(r.fullName ?? r.full_name ?? ''),
    email: typeof r.email === 'string' ? r.email : '',
    phone: typeof r.phone === 'string' && r.phone ? r.phone : null,
    address: typeof r.address === 'string' && r.address ? r.address : null,
    avatarUrl: resolveAssetUrl(r.avatarUrl ?? r.avatar),
    role: r.role === 'ADMIN' ? 'ADMIN' : 'USER',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : null,
    walletBalance: num(r.walletBalance ?? r.wallet_balance) ?? 0,
  };
};
