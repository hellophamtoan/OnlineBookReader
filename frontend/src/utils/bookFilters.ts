// utils/bookFilters.ts
// Trạng thái lọc của trang Sách được lưu trên URL (?search=...&categoryId=...&page=2)
// => F5 không mất bộ lọc, gửi link được, nút Back hoạt động đúng.
import { RULES } from '../config/rules';
import type { BookQuery, BookSort } from '../types';

export type BookFormat = 'all' | 'ebook' | 'print';

export interface BookFilterState {
  search: string;
  categoryId?: number;
  authorId?: number;
  publisherId?: number;
  format: BookFormat;
  sort: BookSort;
  page: number;
}

const SORTS: BookSort[] = ['newest', 'title_asc', 'title_desc'];

const posInt = (v: string | null) => {
  const n = Number(v);
  return v !== null && Number.isInteger(n) && n >= 1 ? n : undefined;
};

export const parseFilters = (sp: URLSearchParams): BookFilterState => {
  const format = sp.get('format');
  const sort = sp.get('sort') as BookSort | null;
  return {
    search: (sp.get('search') ?? '').trim().slice(0, RULES.SEARCH_MAX),
    categoryId: posInt(sp.get('categoryId')),
    authorId: posInt(sp.get('authorId')),
    publisherId: posInt(sp.get('publisherId')),
    format: format === 'ebook' || format === 'print' ? format : 'all',
    sort: sort && SORTS.includes(sort) ? sort : 'newest',
    page: posInt(sp.get('page')) ?? 1,
  };
};

export type FilterPatch = Partial<Record<keyof BookFilterState, string | number | undefined>>;

// Ghi đè một số trường lên URL hiện tại. Đổi bộ lọc (không phải đổi trang) thì quay về trang 1.
export const patchParams = (sp: URLSearchParams, patch: FilterPatch) => {
  const next = new URLSearchParams(sp);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '' || value === 'all' || (key === 'sort' && value === 'newest') || (key === 'page' && value === 1)) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }
  if (!('page' in patch)) next.delete('page');
  return next;
};

export const hasActiveFilter = (f: BookFilterState) =>
  !!(f.search || f.categoryId || f.authorId || f.publisherId || f.format !== 'all');

export const toBookQuery = (f: BookFilterState, limit: number): BookQuery => ({
  search: f.search || undefined,
  categoryId: f.categoryId,
  authorId: f.authorId,
  publisherId: f.publisherId,
  hasEbook: f.format === 'ebook' ? true : f.format === 'print' ? false : undefined,
  sort: f.sort,
  page: f.page,
  limit,
});
