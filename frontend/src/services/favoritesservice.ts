// Yêu thích — NGOÀI hợp đồng API tuần 1–2.
// Khi nối BE thật chưa có endpoint: trả rỗng / false, không làm vỡ trang.
import { ApiError, api } from './api';
import { ENDPOINTS } from './endpoints';

export interface FavoriteBook {
  id: number;
  title: string;
  coverUrl: string | null;
  authors: { id?: number; name: string }[];
  hasEbook: boolean;
  addedAt: string;
}

const soft = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 501)) return fallback;
    throw err;
  }
};

export const favoritesService = {
  async list(): Promise<FavoriteBook[]> {
    return soft(async () => {
      const res = await api.get<{ items: FavoriteBook[] }>(ENDPOINTS.favorites.root);
      return res.data?.items ?? [];
    }, []);
  },
  async toggle(bookId: number) {
    return soft(
      async () => (await api.post(ENDPOINTS.favorites.toggle(bookId))).data as { bookId: number; favorited: boolean },
      { bookId, favorited: false },
    );
  },
  async status(bookId: number) {
    return soft(
      async () => (await api.get(ENDPOINTS.favorites.status(bookId))).data as { bookId: number; favorited: boolean },
      { bookId, favorited: false },
    );
  },
};
