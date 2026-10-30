// services/admin/bookadminservice.ts
// UC007 — API-26..API-30 (API_Tuan2_OnlineBookReader.xlsx)
// Body API-28/29: title, description?, coverUrl? (http(s) hoặc /uploads/...), publisherId?,
//   hasPhysical, hasEbook, price, stock, authorIds[], categoryIds[], status? (chỉ khi sửa).
// Sách chỉ e-book: price = null, stock = 0 (BE cũng tự đặt).
//
// BE gốc chỉ nhận http(s) hoặc /uploads/ (≤ ~500 ký tự). Ảnh EPUB là data:image →
// không gửi lên BE; lưu localStorage và ghép lại khi đọc list/chi tiết (không cần sửa BE).
import { env } from '../../config/env';
import type {
  AdminBookDetail,
  AdminBookListResult,
  AdminBookPayload,
  AdminBookQuery,
  EpubParseResult,
} from '../../types';
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import { mapAdminBookDetail, mapAdminBookList } from './adminmappers';
import {
  getClientCover,
  isDataImageUrl,
  mergeClientCover,
  removeClientCover,
  saveClientCover,
} from '../../utils/clientCoverStore';

/**
 * coverUrl gửi lên API:
 * - mock: giữ data:image (mock chấp nhận)
 * - BE thật: chỉ http(s) hoặc /uploads/ — data:image → null (lưu client sau khi create)
 */
const normalizeCoverUrlForApi = (raw: string | null | undefined): string | null => {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (isDataImageUrl(v)) {
    // Mock nhận data URL; BE thật thì không gửi (tránh «đường dẫn ảnh bìa không hợp lệ»)
    return env.USE_MOCK ? v : null;
  }
  return v;
};

/** Chuẩn hóa body đúng field hợp đồng API-28 / API-29 */
const toBookBody = (p: AdminBookPayload): Record<string, unknown> => {
  const onlyEbook = !!p.hasEbook && !p.hasPhysical;
  const body: Record<string, unknown> = {
    title: p.title.trim(),
    description: (p.description ?? '').trim() || null,
    coverUrl: normalizeCoverUrlForApi(p.coverUrl),
    publisherId: p.publisherId ?? null,
    hasPhysical: !!p.hasPhysical,
    hasEbook: !!p.hasEbook,
    price: onlyEbook ? null : p.price ?? 0,
    stock: onlyEbook ? 0 : Math.max(0, Math.trunc(Number(p.stock) || 0)),
    authorIds: p.authorIds,
    categoryIds: p.categoryIds,
  };
  if (p.status === 'active' || p.status === 'inactive') body.status = p.status;
  return body;
};

const withClientCover = (book: AdminBookDetail): AdminBookDetail => ({
  ...book,
  coverUrl: mergeClientCover(book.id, book.coverUrl),
});

const attachClientCoverAfterSave = (book: AdminBookDetail, payloadCover: string | null | undefined) => {
  if (isDataImageUrl(payloadCover)) {
    saveClientCover(book.id, payloadCover);
    return { ...book, coverUrl: payloadCover!.trim() };
  }
  // Đã có URL thật từ BE → xóa bản local cũ nếu có
  if (book.coverUrl && !isDataImageUrl(book.coverUrl)) removeClientCover(book.id);
  return withClientCover(book);
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
    const mapped = mapAdminBookList(res.data);
    return {
      ...mapped,
      items: mapped.items.map((b) => ({
        ...b,
        coverUrl: mergeClientCover(b.id, b.coverUrl),
      })),
    };
  },

  /** API-27 */
  async get(id: number): Promise<AdminBookDetail> {
    const book = mapAdminBookDetail((await api.get(ENDPOINTS.admin.books.detail(id))).data);
    // Form sửa: ưu tiên bìa local nếu BE không có ảnh
    const local = getClientCover(id);
    if (local && !book.coverUrl) return { ...book, coverUrl: local };
    if (local && isDataImageUrl(book.coverUrl)) return { ...book, coverUrl: local };
    return withClientCover(book);
  },

  /** API-28 */
  async create(p: AdminBookPayload): Promise<AdminBookDetail> {
    const { status: _s, ...createPayload } = p;
    const book = mapAdminBookDetail(
      (await api.post(ENDPOINTS.admin.books.root, toBookBody(createPayload))).data,
    );
    return attachClientCoverAfterSave(book, p.coverUrl);
  },

  /** API-29 */
  async update(id: number, p: AdminBookPayload): Promise<AdminBookDetail> {
    const book = mapAdminBookDetail(
      (await api.put(ENDPOINTS.admin.books.detail(id), toBookBody(p))).data,
    );
    return attachClientCoverAfterSave(book, p.coverUrl);
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

  /**
   * Phân tích EPUB trên trình duyệt (không gọi backend).
   * Mock và BE thật dùng chung; chỉ khi LƯU mới gọi API-28 + API-32.
   */
  async parseEpub(input: { file?: File; url?: string }): Promise<EpubParseResult> {
    const { parseEpubFile, parseEpubUrl } = await import('../../utils/epubParse');
    if (input.file) return parseEpubFile(input.file);
    if (input.url?.trim()) return parseEpubUrl(input.url.trim());
    throw new Error('Cần chọn file EPUB hoặc nhập URL');
  },
};
