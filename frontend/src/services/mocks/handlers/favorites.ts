import { findCatalogBook, getCatalog } from '../catalogdb';
import { isFavorite, listFavorites, toggleFavorite } from '../favoritesdb';
import type { Route } from '../router';
import { idParam, notFound } from './common';
import { requireCustomer } from './guards';

const mapBook = (bookId: number, addedAt: string) => {
  const book = findCatalogBook(bookId);
  if (!book) return null;
  const catalog = getCatalog();
  const authors = book.authorIds
    .map((id) => catalog.authors.find((a) => a.id === id))
    .filter(Boolean)
    .map((a) => ({ id: a!.id, name: a!.name }));
  return {
    id: book.id,
    title: book.title,
    coverUrl: book.coverUrl ?? null,
    authors,
    hasEbook: book.hasEbook,
    addedAt,
  };
};

export const favoriteRoutes: Route[] = [
  {
    method: 'GET',
    path: '/favorites',
    handler: ({ token }) => {
      const user = requireCustomer(token);
      const items = listFavorites(user.id)
        .map((row) => mapBook(row.bookId, row.addedAt))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return { message: 'Lấy danh sách yêu thích thành công', data: { items } };
    },
  },
  {
    method: 'POST',
    path: '/favorites/:bookId/toggle',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = idParam(params.bookId, 'id sách');
      if (!findCatalogBook(bookId)) throw notFound('Không tìm thấy sách');
      const favorited = toggleFavorite(user.id, bookId);
      return {
        message: favorited ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích',
        data: { bookId, favorited },
      };
    },
  },
  {
    method: 'GET',
    path: '/favorites/:bookId/status',
    handler: ({ token, params }) => {
      const user = requireCustomer(token);
      const bookId = idParam(params.bookId, 'id sách');
      return { message: 'OK', data: { bookId, favorited: isFavorite(user.id, bookId) } };
    },
  },
];
