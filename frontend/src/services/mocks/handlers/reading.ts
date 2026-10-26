// services/mocks/handlers/reading.ts
// Giả lập API-10..API-13 (UC006). Mục lục + progress: USER đã đăng nhập.
// Nội dung chương: 10 chương đầu miễn phí; từ chương 11 cần gói còn hiệu lực (kiểm tra phía "backend"/mock).
import { chaptersOf } from '../chapterdb';
import { findCatalogBook } from '../catalogdb';
import { getProgress, saveProgress } from '../readingdb';
import type { Route } from '../router';
import { failValidation, idParam, notFound, str, toNumber } from './common';
import type { FieldErr } from './common';
import { FREE_CHAPTER_LIMIT, requireCustomer, requireReaderOrFreePreview } from './guards';
import { hasActiveSubscription } from '../subscriptiondb';

const ebookOf = (bookId: number) => {
  const book = findCatalogBook(bookId);
  if (!book || book.status !== 'active' || !book.hasEbook) throw notFound('Không tìm thấy sách hoặc sách chưa có bản e-book');
  return book;
};

const DEFAULTS = { fontFamily: 'Arial', fontSize: 16 };

export const readingRoutes: Route[] = [
  // ===== API-10 GET /books/:id/chapters ===== mục lục (USER đăng nhập; không cần gói)
  {
    method: 'GET',
    path: '/books/:id/chapters',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const book = ebookOf(idParam(params.id, 'id sách'));
      const hasSub = hasActiveSubscription(user.id);
      const items = chaptersOf(book.id).map((c) => ({
        id: c.id,
        chapterNumber: c.chapterNumber,
        title: c.title,
        isFree: c.chapterNumber <= FREE_CHAPTER_LIMIT,
        locked: !hasSub && c.chapterNumber > FREE_CHAPTER_LIMIT,
      }));
      return {
        message: 'Lấy mục lục chương thành công',
        data: {
          book: { id: book.id, title: book.title },
          items,
          freeChapterLimit: FREE_CHAPTER_LIMIT,
          hasActiveSubscription: hasSub,
        },
      };
    },
  },

  // ===== API-11 GET /books/:id/chapters/:chapterNumber ===== nội dung một chương
  {
    method: 'GET',
    path: '/books/:id/chapters/:chapterNumber',
    handler: ({ token, params }) => {
      const bookId = idParam(params.id, 'id sách');
      const chapterNumber = idParam(params.chapterNumber, 'số chương');
      requireReaderOrFreePreview(token, chapterNumber);
      const book = ebookOf(bookId);
      const list = chaptersOf(book.id);
      const idx = list.findIndex((c) => c.chapterNumber === chapterNumber);
      if (idx < 0) throw notFound('Không tìm thấy chương');
      const c = list[idx];
      return {
        message: 'Lấy nội dung chương thành công',
        data: {
          bookId: book.id,
          id: c.id,
          chapterNumber: c.chapterNumber,
          title: c.title,
          content: c.content,
          prevChapterNumber: list[idx - 1]?.chapterNumber ?? null,
          nextChapterNumber: list[idx + 1]?.chapterNumber ?? null,
          isFree: c.chapterNumber <= FREE_CHAPTER_LIMIT,
        },
      };
    },
  },

  // ===== API-12 GET /reading/progress/:bookId =====
  {
    method: 'GET',
    path: '/reading/progress/:bookId',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const book = ebookOf(idParam(params.bookId, 'id sách'));
      const row = getProgress(user.id, book.id);
      const chapter = row ? chaptersOf(book.id).find((c) => c.id === row.chapterId) : undefined;
      return {
        message: 'Lấy tiến trình đọc thành công',
        data: row && chapter
          ? {
              bookId: book.id,
              chapterId: chapter.id,
              chapterNumber: chapter.chapterNumber,
              scrollPercent: row.scrollPercent,
              fontFamily: row.fontFamily,
              fontSize: row.fontSize,
            }
          : { bookId: book.id, chapterId: null, chapterNumber: null, scrollPercent: 0, ...DEFAULTS },
      };
    },
  },

  // ===== API-13 PUT /reading/progress/:bookId =====
  {
    method: 'PUT',
    path: '/reading/progress/:bookId',
    handler: ({ token, params, body }) => {
      const user = requireCustomer(token);
      const bookId = idParam(params.bookId, 'id sách');
      const b = (body ?? {}) as Record<string, unknown>;

      const errors: FieldErr[] = [];
      const chapterNumber = toNumber(b.chapterNumber);
      if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
        errors.push({ field: 'chapterNumber', message: 'Số chương không hợp lệ' });
      }
      const scrollPercent = b.scrollPercent === undefined || b.scrollPercent === null ? 0 : toNumber(b.scrollPercent);
      if (!Number.isFinite(scrollPercent) || scrollPercent < 0 || scrollPercent > 100) {
        errors.push({ field: 'scrollPercent', message: 'Vị trí đọc phải từ 0 đến 100' });
      }
      const hasFont = b.fontFamily !== undefined && b.fontFamily !== null;
      if (hasFont && (!str(b.fontFamily).trim() || str(b.fontFamily).length > 100)) {
        errors.push({ field: 'fontFamily', message: 'Font chữ không hợp lệ' });
      }
      const hasSize = b.fontSize !== undefined && b.fontSize !== null;
      const fontSize = hasSize ? toNumber(b.fontSize) : NaN;
      if (hasSize && (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 72)) {
        errors.push({ field: 'fontSize', message: 'Cỡ chữ phải là số nguyên từ 8 đến 72' });
      }
      if (errors.length) throw failValidation(errors);

      // Chỉ cho lưu progress nếu đang trong free limit hoặc có gói
      requireReaderOrFreePreview(token, chapterNumber);

      const book = ebookOf(bookId);
      const chapter = chaptersOf(book.id).find((c) => c.chapterNumber === chapterNumber);
      if (!chapter) throw notFound('Không tìm thấy chương');

      const old = getProgress(user.id, book.id);
      const row = {
        userId: user.id,
        bookId: book.id,
        chapterId: chapter.id,
        scrollPercent,
        fontFamily: hasFont ? str(b.fontFamily).trim() : old?.fontFamily ?? DEFAULTS.fontFamily,
        fontSize: hasSize ? fontSize : old?.fontSize ?? DEFAULTS.fontSize,
      };
      saveProgress(row);
      return {
        message: 'Lưu tiến trình đọc thành công',
        data: {
          bookId: book.id,
          chapterId: chapter.id,
          chapterNumber: chapter.chapterNumber,
          scrollPercent: row.scrollPercent,
          fontFamily: row.fontFamily,
          fontSize: row.fontSize,
        },
      };
    },
  },
];
