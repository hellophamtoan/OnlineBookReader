// services/mocks/readingdb.ts
// "CSDL" giả cho TIẾN TRÌNH ĐỌC (reading_progress): mỗi (người dùng, sách) một dòng. Lưu localStorage (khóa mock_reading_progress).
// Dòng mẫu: user1 đang đọc dở "Nhà giả kim" (sách 1) ở chương 2 -> thử "mở đúng chỗ đọc dở" và thử xóa chương 2 (409 khi quản trị).
import { chaptersOf } from './chapterdb';
import { readJson, writeJson } from './storage';

export interface MockProgress {
  userId: number;
  bookId: number;
  chapterId: number;
  scrollPercent: number;
  fontFamily: string;
  fontSize: number;
  updatedAt: string;
}

const KEY = 'mock_reading_progress';

const seed = (): MockProgress[] => {
  const chapter = chaptersOf(1).find((c) => c.chapterNumber === 2);
  return chapter
    ? [{ userId: 2, bookId: 1, chapterId: chapter.id, scrollPercent: 35, fontFamily: 'Georgia', fontSize: 18, updatedAt: new Date().toISOString() }]
    : [];
};

const all = () => readJson<MockProgress[]>(KEY, seed());

export const getProgress = (userId: number, bookId: number): MockProgress | undefined =>
  all().find((p) => p.userId === userId && p.bookId === bookId);

export const saveProgress = (row: MockProgress) =>
  writeJson(KEY, [...all().filter((p) => !(p.userId === row.userId && p.bookId === row.bookId)), row]);

// API-35: không cho xóa chương đã có người lưu tiến trình
export const hasProgressOnChapter = (chapterId: number): boolean => all().some((p) => p.chapterId === chapterId);

export const listProgressByUser = (userId: number): MockProgress[] =>
  all()
    .filter((p) => p.userId === userId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

