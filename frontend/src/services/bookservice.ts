// services/bookservice.ts
// UC003: API-05 (danh sách/tìm kiếm), API-06 (chi tiết), API-07 (thể loại) + tác giả/NXB (mở rộng MNM C04, C05).
import type { Book, BookListResult, BookQuery, Option } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapBookDetail, mapBookList, mapOptions } from './mappers';

// Tên tham số query gửi lên BE. Hợp đồng UC001–UC003 dùng "search" (MNM dùng "keyword").
// Đổi tên ở đây nếu BE chốt khác.
const QUERY_KEYS = { search: 'search' } as const;

export const bookService = {
  async getBooks(q: BookQuery = {}): Promise<BookListResult> {
    const res = await api.get(ENDPOINTS.books.list, {
      [QUERY_KEYS.search]: q.search?.trim(),
      categoryId: q.categoryId,
      authorId: q.authorId,
      publisherId: q.publisherId,
      hasEbook: q.hasEbook,
      sort: q.sort,
      page: q.page,
      limit: q.limit,
    });
    return mapBookList(res.data);
  },

  async getBook(id: number): Promise<Book> {
    const res = await api.get(ENDPOINTS.books.detail(id));
    return mapBookDetail(res.data);
  },

  async getCategories(): Promise<Option[]> {
    return mapOptions((await api.get(ENDPOINTS.categories)).data);
  },

  // Hai API dưới chưa nằm trong hợp đồng UC001–UC003: nếu BE chưa có (404) thì bộ lọc tương ứng tự ẩn
  async getAuthors(): Promise<Option[]> {
    return mapOptions((await api.get(ENDPOINTS.authors)).data);
  },

  async getPublishers(): Promise<Option[]> {
    return mapOptions((await api.get(ENDPOINTS.publishers)).data);
  },
};
