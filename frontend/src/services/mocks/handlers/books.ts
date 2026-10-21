// services/mocks/handlers/books.ts
// Giả lập API-05 (danh sách), API-06 (chi tiết), API-07 (thể loại) + tác giả/NXB.
// Dạng response theo hợp đồng UC001–UC003; các trường price/stockQuantity/hasEbook/publisher lấy tên theo MNM.
import { MOCK_AUTHORS, MOCK_BOOKS, MOCK_CATEGORIES, MOCK_PUBLISHERS } from '../data';
import type { MockBook } from '../data';
import { MockHttpError } from '../http';
import type { Route } from '../router';
import { normalizeText } from '../../../utils/text';

const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
const name = (list: { id: number; name: string }[], id: number) => list.find((x) => x.id === id)?.name ?? '';
const ref = (list: { id: number; name: string }[], id: number) => ({ id, name: name(list, id) });

const common = (b: MockBook) => ({
  id: b.id,
  title: b.title,
  coverUrl: null as string | null, // null -> FE tự vẽ bìa; BE thật trả "/uploads/covers/xxx.jpg"
  price: b.price,
  stockQuantity: b.stock,
  hasEbook: b.hasEbook,
  hasPhysical: b.hasPhysical,
  publisher: ref(MOCK_PUBLISHERS, b.publisherId),
});

const toListItem = (b: MockBook) => ({
  ...common(b),
  authorNames: [name(MOCK_AUTHORS, b.authorId)],
  categoryNames: [name(MOCK_CATEGORIES, b.categoryId)],
});

const toDetail = (b: MockBook) => ({
  ...common(b),
  description: b.description,
  authors: [ref(MOCK_AUTHORS, b.authorId)],
  categories: [ref(MOCK_CATEGORIES, b.categoryId)],
  createdAt: b.createdAt,
});

const validation = (message = 'Tham số không hợp lệ') => new MockHttpError(400, message, 'VALIDATION_ERROR');

// Đọc số nguyên dương từ query; sai kiểu -> 400
const intParam = (v: string | null, label: string, opts: { min?: number; max?: number } = {}) => {
  if (v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < (opts.min ?? 1) || (opts.max !== undefined && n > opts.max)) throw validation(`${label} không hợp lệ`);
  return n;
};

export const bookRoutes: Route[] = [
  // ===== API-05 GET /books =====
  {
    method: 'GET',
    path: '/books',
    handler: ({ query }) => {
      const page = intParam(query.get('page'), 'page') ?? 1;
      const limit = intParam(query.get('limit'), 'limit', { max: 100 }) ?? 12;
      const categoryId = intParam(query.get('categoryId'), 'categoryId');
      const authorId = intParam(query.get('authorId'), 'authorId');
      const publisherId = intParam(query.get('publisherId'), 'publisherId');
      const sort = query.get('sort') ?? 'newest';
      if (!['newest', 'title_asc', 'title_desc'].includes(sort)) throw validation('sort không hợp lệ');
      const hasEbookRaw = query.get('hasEbook');
      if (hasEbookRaw !== null && hasEbookRaw !== 'true' && hasEbookRaw !== 'false') throw validation('hasEbook không hợp lệ');

      const kw = normalizeText(query.get('search') ?? '');

      let list = MOCK_BOOKS.filter((b) => b.status === 'active'); // chỉ sách đang hiển thị
      if (kw) list = list.filter((b) => normalizeText(`${b.title} ${name(MOCK_AUTHORS, b.authorId)}`).includes(kw)); // tên sách + tác giả (D-06)
      if (categoryId) list = list.filter((b) => b.categoryId === categoryId);
      if (authorId) list = list.filter((b) => b.authorId === authorId);
      if (publisherId) list = list.filter((b) => b.publisherId === publisherId);
      if (hasEbookRaw === 'true') list = list.filter((b) => b.hasEbook);
      if (hasEbookRaw === 'false') list = list.filter((b) => !b.hasEbook);

      list.sort((a, b) =>
        sort === 'title_asc' ? a.title.localeCompare(b.title, 'vi')
        : sort === 'title_desc' ? b.title.localeCompare(a.title, 'vi')
        : b.createdAt.localeCompare(a.createdAt)
      );

      const total = list.length;
      const items = list.slice((page - 1) * limit, page * limit).map(toListItem);
      // Danh sách rỗng vẫn là 200 với items = [] (không trả 404)
      return { message: 'Lấy danh sách sách thành công', data: { items, page, limit, total } };
    },
  },

  // ===== API-06 GET /books/:id =====
  {
    method: 'GET',
    path: '/books/:id',
    handler: ({ params }) => {
      const id = Number(params.id);
      if (!Number.isInteger(id) || id < 1) throw validation('id không hợp lệ');
      const book = MOCK_BOOKS.find((b) => b.id === id && b.status === 'active'); // inactive -> 404 (D-08)
      if (!book) throw new MockHttpError(404, 'Không tìm thấy sách', 'NOT_FOUND');
      return { message: 'Lấy chi tiết sách thành công', data: toDetail(book) };
    },
  },

  // ===== API-07 GET /categories (+ authors, publishers) =====
  { method: 'GET', path: '/categories', handler: () => ({ message: 'Lấy danh mục sách thành công', data: { items: byName(MOCK_CATEGORIES) } }) },
  { method: 'GET', path: '/authors', handler: () => ({ message: 'Lấy danh sách tác giả thành công', data: { items: byName(MOCK_AUTHORS) } }) },
  { method: 'GET', path: '/publishers', handler: () => ({ message: 'Lấy danh sách nhà xuất bản thành công', data: { items: byName(MOCK_PUBLISHERS) } }) },
];
