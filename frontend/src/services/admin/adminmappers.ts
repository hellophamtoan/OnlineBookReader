// services/admin/adminmappers.ts
// UC007 - chuẩn hóa dữ liệu thô của API-14..API-35 về kiểu FE (types/admin.ts).
import type {
  AdminBookDetail, AdminBookListItem, AdminBookListResult, AdminChapter, AdminChapterSaved, EntityStatus, TaxonomyItem,
} from '../../types';
import { bool, isObj, mapPagination, num, resolveAssetUrl } from '../mappers';
import type { Raw } from '../mappers';

const status = (v: unknown): EntityStatus => (v === 'inactive' ? 'inactive' : 'active');
const str = (v: unknown) => (typeof v === 'string' ? v : null);

export const mapTaxonomyItem = (raw: unknown): TaxonomyItem => {
  const r: Raw = isObj(raw) ? raw : {};
  return { id: Number(r.id), name: String(r.name ?? ''), status: status(r.status), bio: str(r.bio) };
};

export const mapTaxonomyList = (data: unknown): TaxonomyItem[] => {
  const d: Raw = isObj(data) ? data : {};
  return Array.isArray(d.items) ? d.items.map(mapTaxonomyItem) : [];
};

const mapBookListItem = (raw: unknown): AdminBookListItem => {
  const r: Raw = isObj(raw) ? raw : {};
  return {
    id: Number(r.id),
    title: String(r.title ?? ''),
    coverUrl: resolveAssetUrl(r.coverUrl),
    hasPhysical: bool(r.hasPhysical) ?? false,
    hasEbook: bool(r.hasEbook) ?? false,
    price: num(r.price),
    stock: num(r.stock) ?? 0,
    status: status(r.status),
    createdAt: str(r.createdAt),
    chapterCount: num(r.chapterCount) ?? 0,
  };
};

export const mapAdminBookList = (data: unknown): AdminBookListResult => {
  const d: Raw = isObj(data) ? data : {};
  const items = Array.isArray(d.items) ? d.items.map(mapBookListItem) : [];
  return { items, pagination: mapPagination(d, items.length) };
};

export const mapAdminBookDetail = (data: unknown): AdminBookDetail => {
  const r: Raw = isObj(data) ? data : {};
  return {
    id: Number(r.id),
    title: String(r.title ?? ''),
    description: str(r.description),
    // Giữ data: / http(s) /uploads; ghép origin cho path tương đối
    coverUrl: resolveAssetUrl(r.coverUrl) ?? str(r.coverUrl),
    publisherId: num(r.publisherId),
    hasPhysical: bool(r.hasPhysical) ?? false,
    hasEbook: bool(r.hasEbook) ?? false,
    price: num(r.price),
    stock: num(r.stock) ?? 0,
    status: status(r.status),
    createdAt: str(r.createdAt),
    updatedAt: str(r.updatedAt),
    authors: Array.isArray(r.authors) ? r.authors.map(mapTaxonomyItem) : [],
    categories: Array.isArray(r.categories) ? r.categories.map(mapTaxonomyItem) : [],
  };
};

export const mapAdminChapter = (data: unknown): AdminChapter => {
  const r: Raw = isObj(data) ? data : {};
  return {
    id: Number(r.id),
    bookId: Number(r.bookId),
    chapterNumber: Number(r.chapterNumber),
    title: String(r.title ?? ''),
    content: typeof r.content === 'string' ? r.content : '',
  };
};

export const mapChapterSaved = (data: unknown): AdminChapterSaved => {
  const r: Raw = isObj(data) ? data : {};
  return { id: Number(r.id), bookId: Number(r.bookId), chapterNumber: Number(r.chapterNumber), title: String(r.title ?? '') };
};
