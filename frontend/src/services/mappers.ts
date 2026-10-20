// services/mappers.ts
// Chuẩn hóa dữ liệu thô của BE về kiểu nội bộ của FE (types/index.ts).
//
// Hai hợp đồng API của nhóm còn lệch nhau (chưa chốt), nên mapper chấp nhận cả hai dạng:
//
//   Nội dung            | UC001–UC003 (nguồn chính)          | MNM (bản mở rộng)
//   --------------------|------------------------------------|----------------------------------
//   Đăng ký: data       | { id, fullName, email, role }      | { user: {...} }
//   Ảnh bìa             | coverUrl                           | coverImage
//   Tác giả / thể loại  | authorNames[] / categoryNames[]    | author {id,name} / category {...}
//   (chi tiết)          | authors[] / categories[]           | author {...} / category {...}
//   Phân trang          | data.page, data.limit, data.total  | data.pagination {page,limit,total,totalPages}
//   Chi tiết sách       | data = {...}                       | data.book = {...}
//
// Khi BE chốt một dạng, có thể xóa nhánh còn lại ở đây mà không đụng tới trang/component.
import { env } from '../config/env';
import type { AuthUser, Book, BookListResult, NamedRef, Option, Pagination, Role } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

// MySQL DECIMAL thường trả về chuỗi "79000.00" -> ép về số
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

const bool = (v: unknown): boolean | null => {
  if (v === null || v === undefined) return null;
  return v === true || v === 1 || v === '1' || v === 'true';
};

// "/uploads/covers/a.jpg" -> "http://localhost:5000/uploads/covers/a.jpg"
export const resolveAssetUrl = (url?: unknown): string | null => {
  if (typeof url !== 'string' || !url) return null;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  return `${env.ASSET_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
};

const toRef = (v: unknown): NamedRef | null => {
  if (typeof v === 'string') return { name: v };
  if (isObj(v) && typeof v.name === 'string') return { id: num(v.id) ?? undefined, name: v.name };
  return null;
};

const toRefs = (list: unknown, single: unknown, names: unknown): NamedRef[] => {
  const source = Array.isArray(list) ? list : single ? [single] : Array.isArray(names) ? names : [];
  return source.map(toRef).filter((r): r is NamedRef => r !== null);
};

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

export const mapBook = (raw: unknown): Book => {
  const r: Raw = isObj(raw) ? raw : {};
  const publisher = toRef(r.publisher ?? (r.publisherName ? r.publisherName : null));
  return {
    id: Number(r.id),
    title: String(r.title ?? ''),
    coverUrl: resolveAssetUrl(r.coverUrl ?? r.coverImage),
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

export const mapBookList = (data: unknown): BookListResult => {
  const d: Raw = isObj(data) ? data : {};
  const items = Array.isArray(d.items) ? d.items.map(mapBook) : [];
  return { items, pagination: mapPagination(d, items.length) };
};

// Chi tiết sách: data có thể là sách trực tiếp hoặc { book }
export const mapBookDetail = (data: unknown): Book => mapBook(isObj(data) && isObj(data.book) ? data.book : data);

export const mapOptions = (data: unknown): Option[] => {
  const items = isObj(data) && Array.isArray(data.items) ? data.items : [];
  return items.flatMap((i: unknown) => (isObj(i) && typeof i.name === 'string' ? [{ id: Number(i.id), name: i.name }] : []));
};
