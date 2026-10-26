// services/admin/chapteradminservice.ts
// UC007 — API-31..35 chương e-book (API_Tuan2)
// API-32/34 body: { chapterNumber, title, content }
// API-35: xóa thật; 409 nếu đã có tiến trình đọc trên chương
import type { AdminChapter, AdminChapterPayload, AdminChapterSaved, ChapterList } from '../../types';
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import { mapChapterList } from '../readermappers';
import { mapAdminChapter, mapChapterSaved } from './adminmappers';

const toChapterBody = (p: AdminChapterPayload) => ({
  chapterNumber: Number(p.chapterNumber),
  title: p.title.trim(),
  content: p.content,
});

export const chapterAdminService = {
  /** API-31 */
  async list(bookId: number): Promise<ChapterList> {
    return mapChapterList((await api.get(ENDPOINTS.admin.books.chapters(bookId))).data);
  },

  /** API-32 — sách phải hasEbook (không thì 400) */
  async create(bookId: number, p: AdminChapterPayload): Promise<AdminChapterSaved> {
    return mapChapterSaved((await api.post(ENDPOINTS.admin.books.chapters(bookId), toChapterBody(p))).data);
  },

  /** API-33 */
  async get(id: number): Promise<AdminChapter> {
    return mapAdminChapter((await api.get(ENDPOINTS.admin.chapter(id))).data);
  },

  /** API-34 */
  async update(id: number, p: AdminChapterPayload): Promise<AdminChapterSaved> {
    return mapChapterSaved((await api.put(ENDPOINTS.admin.chapter(id), toChapterBody(p))).data);
  },

  /** API-35 */
  async remove(id: number): Promise<void> {
    await api.delete(ENDPOINTS.admin.chapter(id));
  },
};
