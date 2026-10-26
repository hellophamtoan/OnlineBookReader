// utils/adminFilters.ts
// Bộ lọc của các trang danh sách quản trị lưu trên URL (?search=...&status=inactive&page=2), cùng cách làm với bookFilters.ts.
import type { EntityStatus } from '../types';

export interface AdminFilterState {
  search: string;
  status?: EntityStatus;
  page: number;
}

export const parseAdminFilters = (sp: URLSearchParams): AdminFilterState => {
  const status = sp.get('status');
  const page = Number(sp.get('page'));
  return {
    search: (sp.get('search') ?? '').trim().slice(0, 100),
    status: status === 'active' || status === 'inactive' ? status : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
};

// Đổi bộ lọc (không phải đổi trang) thì quay về trang 1
export const patchAdminParams = (sp: URLSearchParams, patch: { search?: string; status?: EntityStatus | ''; page?: number }) => {
  const next = new URLSearchParams(sp);
  if ('search' in patch) {
    if (patch.search) next.set('search', patch.search);
    else next.delete('search');
  }
  if ('status' in patch) {
    if (patch.status) next.set('status', patch.status);
    else next.delete('status');
  }
  if (!('page' in patch)) next.delete('page');
  else if (patch.page && patch.page > 1) next.set('page', String(patch.page));
  else next.delete('page');
  return next;
};
