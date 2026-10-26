// services/admin/taxonomyservice.ts
// UC007 — API-14..25 (categories / authors / publishers)
import type { TaxonomyItem, TaxonomyKind, TaxonomyPayload, TaxonomyQuery } from '../../types';
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import { mapTaxonomyItem, mapTaxonomyList } from './adminmappers';

const toBody = (kind: TaxonomyKind, p: TaxonomyPayload) => {
  const body: Record<string, unknown> = {
    name: p.name.trim(),
  };
  if (kind === 'authors') body.bio = (p.bio ?? '').trim();
  if (p.status === 'active' || p.status === 'inactive') body.status = p.status;
  return body;
};

export const taxonomyService = {
  async list(kind: TaxonomyKind, q: TaxonomyQuery = {}): Promise<TaxonomyItem[]> {
    const res = await api.get(ENDPOINTS.admin.taxonomy[kind], {
      status: q.status,
      search: q.search?.trim() || undefined,
    });
    return mapTaxonomyList(res.data);
  },

  async create(kind: TaxonomyKind, p: TaxonomyPayload): Promise<TaxonomyItem> {
    const { status: _s, ...createOnly } = p;
    return mapTaxonomyItem((await api.post(ENDPOINTS.admin.taxonomy[kind], toBody(kind, createOnly))).data);
  },

  async update(kind: TaxonomyKind, id: number, p: TaxonomyPayload): Promise<TaxonomyItem> {
    return mapTaxonomyItem((await api.put(ENDPOINTS.admin.taxonomyItem(kind, id), toBody(kind, p))).data);
  },

  async deactivate(kind: TaxonomyKind, id: number): Promise<void> {
    await api.delete(ENDPOINTS.admin.taxonomyItem(kind, id));
  },

  async activate(kind: TaxonomyKind, item: TaxonomyItem): Promise<TaxonomyItem> {
    return this.update(kind, item.id, {
      name: item.name,
      bio: item.bio ?? '',
      status: 'active',
    });
  },
};
