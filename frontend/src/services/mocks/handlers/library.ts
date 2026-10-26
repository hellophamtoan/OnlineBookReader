import { findCatalogBook, getCatalog } from '../catalogdb';
import { addToLibrary, isInLibrary, listLibrary, removeFromLibrary } from '../librarydb';
import { getProgress, listProgressByUser } from '../readingdb';
import { chaptersOf } from '../chapterdb';
import type { Route } from '../router';
import { idParam, notFound } from './common';
import { requireCustomer } from './guards';

const bookSummary = (bookId: number, userId: number) => {
  const book = findCatalogBook(bookId);
  if (!book) return null;
  const catalog = getCatalog();
  const authors = book.authorIds
    .map((id) => catalog.authors.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => ({ id: a!.id, name: a!.name }));
  const prog = getProgress(userId, bookId);
  const chapter = prog ? chaptersOf(bookId).find((c) => c.id === prog.chapterId) : undefined;
  return {
    id: book.id,
    title: book.title,
    coverUrl: book.coverUrl ?? null,
    authors,
    hasEbook: book.hasEbook,
    lastChapterNumber: chapter?.chapterNumber ?? null,
    lastChapterTitle: chapter?.title ?? null,
    addedAt: null as string | null,
  };
};

export const libraryRoutes: Route[] = [

  {
    method: 'GET',
    path: '/library/reading',
    handler: ({ token }) => {
      const user = requireCustomer(token);
      const items = listProgressByUser(user.id)
        .map((prog) => {
          const s = bookSummary(prog.bookId, user.id);
          if (!s || !s.hasEbook) return null;
          return { ...s, addedAt: prog.updatedAt };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { message: 'Lấy sách đang đọc thành công', data: { items } };
    },
  },
  {
    method: 'GET',
    path: '/library',
    handler: ({ token }) => {
      const user = requireCustomer(token);
      const items = listLibrary(user.id)
        .map((row) => {
          const s = bookSummary(row.bookId, user.id);
          if (!s) return null;
          return { ...s, addedAt: row.addedAt };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { message: 'Lấy thư viện cá nhân thành công', data: { items } };
    },
  },
  {
    method: 'POST',
    path: '/library/:bookId',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = idParam(params.bookId, 'id sách');
      if (!findCatalogBook(bookId)) throw notFound('Không tìm thấy sách');
      addToLibrary(user.id, bookId);
      return { message: 'Đã thêm sách vào thư viện', data: { bookId, inLibrary: true } };
    },
  },
  {
    method: 'DELETE',
    path: '/library/:bookId',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = idParam(params.bookId, 'id sách');
      removeFromLibrary(user.id, bookId);
      return { message: 'Đã xóa sách khỏi thư viện', data: { bookId, inLibrary: false } };
    },
  },
  {
    method: 'GET',
    path: '/library/:bookId/status',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = idParam(params.bookId, 'id sách');
      return { message: 'OK', data: { bookId, inLibrary: isInLibrary(user.id, bookId) } };
    },
  },
];
