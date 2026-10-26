// services/bookservice.ts
// UC003 + filter mở rộng (BE book.controller đã hỗ trợ authorId, publisherId, hasEbook)
import type { Book, BookListResult, BookQuery, Option } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapBookDetail, mapBookList, mapOptions } from './mappers';

export const bookService = {
  async getBooks(q: BookQuery = {}): Promise<BookListResult> {
    const res = await api.get(ENDPOINTS.books.list, {
      search: q.search?.trim() || undefined,
      categoryId: q.categoryId,
      authorId: q.authorId,
      publisherId: q.publisherId,
      hasEbook: q.hasEbook,
      page: q.page ?? 1,
      limit: q.limit ?? 12,
      sort: q.sort || 'newest',
    });
    return mapBookList(res.data);
  },

  async getBook(id: number): Promise<Book> {
    return mapBookDetail((await api.get(ENDPOINTS.books.detail(id))).data);
  },

  async getCategories(): Promise<Option[]> {
    return mapOptions((await api.get(ENDPOINTS.categories)).data);
  },

  async getAuthors(): Promise<Option[]> {
    try {
      return mapOptions((await api.get(ENDPOINTS.authors)).data);
    } catch {
      return [];
    }
  },

  async getPublishers(): Promise<Option[]> {
    try {
      return mapOptions((await api.get(ENDPOINTS.publishers)).data);
    } catch {
      return [];
    }
  },
};
