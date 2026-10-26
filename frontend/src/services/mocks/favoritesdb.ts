import { readJson, writeJson } from './storage';

export interface FavoriteItem {
  userId: number;
  bookId: number;
  addedAt: string;
}

const KEY = 'mock_user_favorites';
const all = () => readJson<FavoriteItem[]>(KEY, []);

export const listFavorites = (userId: number) =>
  all().filter((x) => x.userId === userId).sort((a, b) => b.addedAt.localeCompare(a.addedAt));

export const isFavorite = (userId: number, bookId: number) =>
  all().some((x) => x.userId === userId && x.bookId === bookId);

export const addFavorite = (userId: number, bookId: number) => {
  if (isFavorite(userId, bookId)) return;
  writeJson(KEY, [...all(), { userId, bookId, addedAt: new Date().toISOString() }]);
};

export const removeFavorite = (userId: number, bookId: number) =>
  writeJson(KEY, all().filter((x) => !(x.userId === userId && x.bookId === bookId)));

export const toggleFavorite = (userId: number, bookId: number): boolean => {
  if (isFavorite(userId, bookId)) {
    removeFavorite(userId, bookId);
    return false;
  }
  addFavorite(userId, bookId);
  return true;
};
