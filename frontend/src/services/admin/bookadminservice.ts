// services/admin/bookadminservice.ts
// UC007 — API-26..API-30 (API_Tuan2_OnlineBookReader.xlsx)
// Body API-28/29: title, description?, coverUrl? (http(s) hoặc /uploads/...), publisherId?,
//   hasPhysical, hasEbook, price, stock, authorIds[], categoryIds[], status? (chỉ khi sửa).
// Sách chỉ e-book: price = null, stock = 0 (BE cũng tự đặt).
import { env } from '../../config/env';
import type { AdminBookDetail, AdminBookListResult, AdminBookPayload, AdminBookQuery } from '../../types';
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import { mapAdminBookDetail, mapAdminBookList } from './adminmappers';

/** coverUrl theo hợp đồng: http(s)://... hoặc /uploads/... — không gửi data: lên BE thật */
const normalizeCoverUrl = (raw: string | null | undefined): string | null => {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (v.startsWith('data:image/')) return env.USE_MOCK ? v : null;
  return v;
};

/** Chuẩn hóa body đúng field hợp đồng API-28 / API-29 */
const toBookBody = (p: AdminBookPayload): Record<string, unknown> => {
  const onlyEbook = !!p.hasEbook && !p.hasPhysical;
  const body: Record<string, unknown> = {
    title: p.title.trim(),
    description: (p.description ?? '').trim() || null,
    coverUrl: normalizeCoverUrl(p.coverUrl),
    publisherId: p.publisherId ?? null,
    hasPhysical: !!p.hasPhysical,
    hasEbook: !!p.hasEbook,
    price: onlyEbook ? null : p.price ?? 0,
    stock: onlyEbook ? 0 : Math.max(0, Math.trunc(Number(p.stock) || 0)),
    authorIds: p.authorIds,
    categoryIds: p.categoryIds,
  };
  // status chỉ khi sửa (API-29)
  if (p.status === 'active' || p.status === 'inactive') body.status = p.status;
  return body;
};

export const bookAdminService = {
  /** API-26 */
  async list(q: AdminBookQuery = {}): Promise<AdminBookListResult> {
    const res = await api.get(ENDPOINTS.admin.books.root, {
      search: q.search?.trim() || undefined,
      status: q.status,
      page: q.page ?? 1,
      limit: q.limit ?? 20,
    });
    return mapAdminBookList(res.data);
  },

  /** API-27 */
  async get(id: number): Promise<AdminBookDetail> {
    return mapAdminBookDetail((await api.get(ENDPOINTS.admin.books.detail(id))).data);
  },

  /** API-28 */
  async create(p: AdminBookPayload): Promise<AdminBookDetail> {
    const { status: _s, ...createPayload } = p;
    return mapAdminBookDetail((await api.post(ENDPOINTS.admin.books.root, toBookBody(createPayload))).data);
  },

  /** API-29 */
  async update(id: number, p: AdminBookPayload): Promise<AdminBookDetail> {
    return mapAdminBookDetail((await api.put(ENDPOINTS.admin.books.detail(id), toBookBody(p))).data);
  },

  /** API-30 — xóa mềm (status = inactive) */
  async deactivate(id: number): Promise<void> {
    await api.delete(ENDPOINTS.admin.books.detail(id));
  },

  /** Kích hoạt lại: PUT đủ body + status active (không có API riêng) */
  async activate(id: number): Promise<AdminBookDetail> {
    const b = await this.get(id);
    return this.update(id, {
      title: b.title,
      description: b.description ?? '',
      coverUrl: b.coverUrl,
      publisherId: b.publisherId,
      hasPhysical: b.hasPhysical,
      hasEbook: b.hasEbook,
      price: b.price,
      stock: b.stock,
      authorIds: b.authors.map((a) => a.id),
      categoryIds: b.categories.map((c) => c.id),
      status: 'active',
    });
  },
};
