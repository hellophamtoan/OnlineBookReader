// services/admin/taxonomyservice.ts
// UC007 — API-14..25 (categories / authors / publishers)
import type { TaxonomyItem, TaxonomyKind, TaxonomyPayload, TaxonomyQuery } from '../../types';
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import { mapTaxonomyItem, mapTaxonomyList } from './adminmappers';

// [Xử lý] Tạo body thêm/sửa danh mục.
const toBody = (kind: TaxonomyKind, p: TaxonomyPayload) => {
  const body: Record<string, unknown> = {
    name: p.name.trim(),
  };
  if (kind === 'authors') body.bio = (p.bio ?? '').trim();
  if (p.status === 'active' || p.status === 'inactive') body.status = p.status;
  return body;
};

export const taxonomyService = {
  // [Gọi API] GET /admin/{categories|authors|publishers} – danh sách danh mục.
  async list(kind: TaxonomyKind, q: TaxonomyQuery = {}): Promise<TaxonomyItem[]> {
    const res = await api.get(ENDPOINTS.admin.taxonomy[kind], {
      status: q.status,
      search: q.search?.trim() || undefined,
    });
    return mapTaxonomyList(res.data);
  },

  // [Gọi API] POST /admin/{loại} – thêm danh mục.
  async create(kind: TaxonomyKind, p: TaxonomyPayload): Promise<TaxonomyItem> {
    const { status: _s, ...createOnly } = p;
    return mapTaxonomyItem((await api.post(ENDPOINTS.admin.taxonomy[kind], toBody(kind, createOnly))).data);
  },

  // [Gọi API] PUT /admin/{loại}/:id – sửa danh mục.
  async update(kind: TaxonomyKind, id: number, p: TaxonomyPayload): Promise<TaxonomyItem> {
    return mapTaxonomyItem((await api.put(ENDPOINTS.admin.taxonomyItem(kind, id), toBody(kind, p))).data);
  },

  // [Gọi API] DELETE /admin/{loại}/:id – ngừng hoạt động (xóa mềm).
  async deactivate(kind: TaxonomyKind, id: number): Promise<void> {
    await api.delete(ENDPOINTS.admin.taxonomyItem(kind, id));
  },

  // [Gọi API] PUT /admin/{loại}/:id – kích hoạt lại.
  async activate(kind: TaxonomyKind, item: TaxonomyItem): Promise<TaxonomyItem> {
    return this.update(kind, item.id, {
      name: item.name,
      bio: item.bio ?? '',
      status: 'active',
    });
  },
};
