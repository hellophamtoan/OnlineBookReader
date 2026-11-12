// services/bookservice.ts
// UC003 + filter mở rộng (BE book.controller đã hỗ trợ authorId, publisherId, hasEbook)
import type { Book, BookListResult, BookQuery, Option } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapBookDetail, mapBookList, mapOptions } from './mappers';

export const bookService = {
  // [Gọi API] GET /books – trang chủ, trang Sách, ô tìm kiếm.
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

  // [Gọi API] GET /books/:id – trang Chi tiết sách.
  async getBook(id: number): Promise<Book> {
    return mapBookDetail((await api.get(ENDPOINTS.books.detail(id))).data);
  },

  // [Gọi API] GET /categories – bộ lọc thể loại.
  async getCategories(): Promise<Option[]> {
    return mapOptions((await api.get(ENDPOINTS.categories)).data);
  },

  // [Gọi API] GET /authors – bộ lọc tác giả.
  async getAuthors(): Promise<Option[]> {
    try {
      return mapOptions((await api.get(ENDPOINTS.authors)).data);
    } catch {
      return [];
    }
  },

  // [Gọi API] GET /publishers – bộ lọc NXB.
  async getPublishers(): Promise<Option[]> {
    try {
      return mapOptions((await api.get(ENDPOINTS.publishers)).data);
    } catch {
      return [];
    }
  },
};
