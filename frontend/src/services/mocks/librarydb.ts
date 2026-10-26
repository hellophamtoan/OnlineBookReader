import { readJson, writeJson } from './storage';

export interface LibraryItem {
  userId: number;
  bookId: number;
  addedAt: string;
}

const KEY = 'mock_user_library';
const all = () => readJson<LibraryItem[]>(KEY, []);

export const listLibrary = (userId: number) =>
  all().filter((x) => x.userId === userId).sort((a, b) => b.addedAt.localeCompare(a.addedAt));

export const isInLibrary = (userId: number, bookId: number) =>
  all().some((x) => x.userId === userId && x.bookId === bookId);

export const addToLibrary = (userId: number, bookId: number) => {
  if (isInLibrary(userId, bookId)) return;
  writeJson(KEY, [...all(), { userId, bookId, addedAt: new Date().toISOString() }]);
};

export const removeFromLibrary = (userId: number, bookId: number) =>
  writeJson(KEY, all().filter((x) => !(x.userId === userId && x.bookId === bookId)));
