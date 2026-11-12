// Thư viện cá nhân — NGOÀI hợp đồng API tuần 1–2.
// Khi nối BE thật chưa có endpoint: trả rỗng / false, không làm vỡ trang.
import { ApiError, api } from './api';
import { ENDPOINTS } from './endpoints';

export interface LibraryBook {
  id: number;
  title: string;
  coverUrl: string | null;
  authors: { id?: number; name: string }[];
  hasEbook: boolean;
  lastChapterNumber: number | null;
  lastChapterTitle: string | null;
  addedAt: string | null;
}

const soft = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) return fallback;
    throw err;
  }
};

export const libraryService = {
  // [Gọi API] GET /library – sách đã lưu (trang Thư viện).
  async list(): Promise<LibraryBook[]> {
    return soft(async () => {
      const res = await api.get<{ items: LibraryBook[] }>(ENDPOINTS.library.root);
      return res.data?.items ?? [];
    }, []);
  },
  // [Gọi API] GET /library/reading – sách đang đọc dở (trang Thư viện).
  /** Sách đang đọc (có tiến trình). BE chưa có → fallback lọc list() có lastChapterNumber */
  async listReading(): Promise<LibraryBook[]> {
    try {
      const res = await api.get<{ items: LibraryBook[] }>(ENDPOINTS.library.reading);
      return res.data?.items ?? [];
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 501)) throw err;
      const all = await libraryService.list();
      return all.filter((b) => b.lastChapterNumber != null);
    }
  },
  // [Gọi API] POST /library/:bookId – nút Lưu vào thư viện.
  async add(bookId: number) {
    return soft(
      async () => (await api.post(ENDPOINTS.library.item(bookId))).data as { bookId: number; inLibrary: boolean },
      { bookId, inLibrary: false },
    );
  },
  // [Gọi API] DELETE /library/:bookId – bỏ lưu sách.
  async remove(bookId: number) {
    return soft(
      async () => (await api.delete(ENDPOINTS.library.item(bookId))).data as { bookId: number; inLibrary: boolean },
      { bookId, inLibrary: false },
    );
  },
  // [Gọi API] GET /library/:bookId/status – biết sách đã lưu chưa để hiện đúng nút.
  async status(bookId: number) {
    return soft(
      async () => (await api.get(ENDPOINTS.library.status(bookId))).data as { bookId: number; inLibrary: boolean },
      { bookId, inLibrary: false },
    );
  },
};
