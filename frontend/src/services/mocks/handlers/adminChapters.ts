// services/mocks/handlers/adminChapters.ts
// Giả lập API-31..API-35 (UC007 chương e-book). Chương không có cột status nên XÓA THẬT; 409 nếu đã có người lưu tiến trình.
// Nội dung được làm sạch khi lưu (giống BE) bằng đúng hàm sanitize mà FE dùng khi hiển thị.
import { ADMIN } from '../../../config/admin';
import { sanitizeChapterHtml } from '../../../utils/sanitize';
import { findCatalogBook } from '../catalogdb';
import { allChapters, chaptersOf, findChapterById, nextChapterId, saveChapters } from '../chapterdb';
import { hasProgressOnChapter } from '../readingdb';
import type { Route } from '../router';
import { badRequest, conflict, failValidation, idParam, notFound, str, toNumber } from './common';
import type { FieldErr } from './common';
import { requireAdmin } from './guards';

const bookOr404 = (id: number) => {
  const book = findCatalogBook(id);
  if (!book) throw notFound('Không tìm thấy sách');
  return book;
};

const parseChapter = (body: unknown) => {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: FieldErr[] = [];
  const chapterNumber = toNumber(b.chapterNumber);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) errors.push({ field: 'chapterNumber', message: 'Số chương phải là số nguyên dương' });
  const title = str(b.title).trim();
  if (!title) errors.push({ field: 'title', message: 'Vui lòng nhập tiêu đề chương' });
  else if (title.length > ADMIN.TITLE_MAX) errors.push({ field: 'title', message: `Tiêu đề tối đa ${ADMIN.TITLE_MAX} ký tự` });
  const content = str(b.content);
  if (!content.trim()) errors.push({ field: 'content', message: 'Vui lòng nhập nội dung chương' });
  else if (content.length > ADMIN.CONTENT_MAX) errors.push({ field: 'content', message: 'Nội dung chương quá dài' });
  if (errors.length) throw failValidation(errors);
  return { chapterNumber, title, content: sanitizeChapterHtml(content) };
};

const summary = (c: { id: number; bookId: number; chapterNumber: number; title: string }) => ({ id: c.id, bookId: c.bookId, chapterNumber: c.chapterNumber, title: c.title });

export const adminChapterRoutes: Route[] = [
  // ===== API-31 GET /admin/books/:bookId/chapters =====
  {
    method: 'GET',
    path: '/admin/books/:bookId/chapters',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const book = bookOr404(idParam(params.bookId, 'id sách'));
      return {
        message: 'Lấy mục lục chương thành công',
        data: { book: { id: book.id, title: book.title }, items: chaptersOf(book.id).map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, title: c.title })) },
      };
    },
  },

  // ===== API-32 POST /admin/books/:bookId/chapters =====
  {
    method: 'POST',
    path: '/admin/books/:bookId/chapters',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const book = bookOr404(idParam(params.bookId, 'id sách'));
      const p = parseChapter(body);
      if (!book.hasEbook) throw badRequest('Sách chưa bật hình thức e-book nên không thể thêm chương');
      // Chèn tại STT: dồn các chương >= STT lên +1
      const shifted = allChapters().map((c) =>
        c.bookId === book.id && c.chapterNumber >= p.chapterNumber
          ? { ...c, chapterNumber: c.chapterNumber + 1 }
          : c,
      );
      const created = { id: nextChapterId(), bookId: book.id, ...p };
      saveChapters([...shifted, created]);
      return { status: 201, message: 'Thêm chương thành công', data: summary(created) };
    },
  },

  // ===== API-33 GET /admin/chapters/:id =====
  {
    method: 'GET',
    path: '/admin/chapters/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const c = findChapterById(idParam(params.id, 'id chương'));
      if (!c) throw notFound('Không tìm thấy chương');
      return { message: 'Lấy chương thành công', data: { id: c.id, bookId: c.bookId, chapterNumber: c.chapterNumber, title: c.title, content: c.content } };
    },
  },

  // ===== API-34 PUT /admin/chapters/:id =====
  {
    method: 'PUT',
    path: '/admin/chapters/:id',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const id = idParam(params.id, 'id chương');
      const current = findChapterById(id);
      if (!current) throw notFound('Không tìm thấy chương');
      const p = parseChapter(body);
      const others = chaptersOf(current.bookId)
        .filter((c) => c.id !== id)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
      const insertAt = Math.max(0, Math.min(others.length, p.chapterNumber - 1));
      const ordered = [...others];
      ordered.splice(insertAt, 0, { ...current, ...p });
      const renumbered = ordered.map((c, i) => ({ ...c, chapterNumber: i + 1 }));
      const next = renumbered.find((c) => c.id === id)!;
      const byId = new Map(renumbered.map((c) => [c.id, c]));
      saveChapters(allChapters().map((c) => byId.get(c.id) ?? c));
      return { message: 'Cập nhật chương thành công', data: summary(next) };
    },
  },

  // ===== API-35 DELETE /admin/chapters/:id ===== xóa thật
  {
    method: 'DELETE',
    path: '/admin/chapters/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = idParam(params.id, 'id chương');
      if (!findChapterById(id)) throw notFound('Không tìm thấy chương');
      if (hasProgressOnChapter(id)) throw conflict('Không thể xóa chương đã có người dùng lưu tiến trình đọc');
      saveChapters(allChapters().filter((c) => c.id !== id));
      return { message: 'Đã xóa chương', data: null };
    },
  },
];
