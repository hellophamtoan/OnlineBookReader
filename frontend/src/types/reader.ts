// types/reader.ts - kiểu dữ liệu UC006 (đọc sách trực tuyến). Được types/index.ts re-export.

export interface ChapterSummary {
  id: number;
  chapterNumber: number;
  title: string;
  /** Chương thuộc phần miễn phí (≤ free limit) */
  isFree?: boolean;
  /** true = cần gói đọc để mở */
  locked?: boolean;
}

export interface ChapterList {
  book: { id: number; title: string };
  items: ChapterSummary[];
  freeChapterLimit?: number;
  hasActiveSubscription?: boolean;
}

// API-11: content là HTML. BE đã làm sạch nhưng FE vẫn phải làm sạch lại trước khi hiển thị (utils/sanitize.ts)
export interface Chapter {
  bookId: number;
  id: number;
  chapterNumber: number;
  title: string;
  content: string;
  prevChapterNumber: number | null;
  nextChapterNumber: number | null;
}

// Tùy chỉnh hiển thị của người đọc (lưu cùng tiến trình)
export interface ReadingSettings {
  fontFamily: string;
  fontSize: number;
}

// API-12: chưa có tiến trình -> chapterId/chapterNumber = null, scrollPercent 0, font mặc định
export interface ReadingProgress extends ReadingSettings {
  bookId: number;
  chapterId: number | null;
  chapterNumber: number | null;
  scrollPercent: number;
}

// Body của API-13
export interface SaveProgressPayload {
  chapterNumber: number;
  scrollPercent?: number;
  fontFamily?: string;
  fontSize?: number;
}
