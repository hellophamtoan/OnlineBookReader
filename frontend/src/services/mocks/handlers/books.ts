// services/mocks/handlers/books.ts
// Giả lập API-05 (danh sách), API-06 (chi tiết), API-07 (thể loại) + tác giả/NXB. CÔNG KHAI: chỉ hiện mục đang hoạt động.
// Dữ liệu đọc từ catalogdb.ts (cùng nguồn với khu quản trị UC007) nên Admin sửa thì trang người dùng đổi theo.
import { MockHttpError } from '../http';
import type { Route } from '../router';
import { normalizeText } from '../../../utils/text';
import { getCatalog } from '../catalogdb';
import type { CatalogBook, CatalogRef, CatalogState } from '../catalogdb';

const byName = <T extends { name: string }>(list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
const nameOf = (list: CatalogRef[], id: number) => list.find((x) => x.id === id)?.name ?? '';
const refOf = (list: CatalogRef[], id: number | null) => {
  const r = list.find((x) => x.id === id);
  return r ? { id: r.id, name: r.name } : null;
};
const publicRefs = (list: CatalogRef[]) => byName(list.filter((x) => x.status === 'active')).map(({ id, name }) => ({ id, name }));

const common = (b: CatalogBook, c: CatalogState) => ({
  id: b.id,
  title: b.title,
  coverUrl: b.coverUrl, // null -> FE tự vẽ bìa; BE thật trả "/uploads/covers/xxx.jpg"
  price: b.price,
  stockQuantity: b.stock, // tồn kho thực tế (đã trừ các đơn mới đặt)
  hasEbook: b.hasEbook,
  hasPhysical: b.hasPhysical,
  publisher: refOf(c.publishers, b.publisherId),
});

const toListItem = (b: CatalogBook, c: CatalogState) => ({
  ...common(b, c),
  authorNames: b.authorIds.map((id) => nameOf(c.authors, id)).filter(Boolean),
  categoryNames: b.categoryIds.map((id) => nameOf(c.categories, id)).filter(Boolean),
});

const toDetail = (b: CatalogBook, c: CatalogState) => ({
  ...common(b, c),
  description: b.description,
  authors: b.authorIds.map((id) => refOf(c.authors, id)).filter(Boolean),
  categories: b.categoryIds.map((id) => refOf(c.categories, id)).filter(Boolean),
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
      const c = getCatalog();

      let list = c.books.filter((b) => b.status === 'active'); // chỉ sách đang hiển thị
      if (kw) {
        // tên sách + tác giả (D-06)
        list = list.filter((b) => normalizeText(`${b.title} ${b.authorIds.map((id) => nameOf(c.authors, id)).join(' ')}`).includes(kw));
      }
      if (categoryId) list = list.filter((b) => b.categoryIds.includes(categoryId));
      if (authorId) list = list.filter((b) => b.authorIds.includes(authorId));
      if (publisherId) list = list.filter((b) => b.publisherId === publisherId);
      if (hasEbookRaw === 'true') list = list.filter((b) => b.hasEbook);
      if (hasEbookRaw === 'false') list = list.filter((b) => !b.hasEbook);

      list.sort((a, b) =>
        sort === 'title_asc' ? a.title.localeCompare(b.title, 'vi')
        : sort === 'title_desc' ? b.title.localeCompare(a.title, 'vi')
        : b.createdAt.localeCompare(a.createdAt)
      );

      const total = list.length;
      const items = list.slice((page - 1) * limit, page * limit).map((b) => toListItem(b, c));
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
      const c = getCatalog();
      const book = c.books.find((b) => b.id === id && b.status === 'active'); // inactive -> 404 (D-08)
      if (!book) throw new MockHttpError(404, 'Không tìm thấy sách', 'NOT_FOUND');
      return { message: 'Lấy chi tiết sách thành công', data: toDetail(book, c) };
    },
  },

  // ===== API-07 GET /categories (+ authors, publishers) =====
  { method: 'GET', path: '/categories', handler: () => ({ message: 'Lấy danh mục sách thành công', data: { items: publicRefs(getCatalog().categories) } }) },
  { method: 'GET', path: '/authors', handler: () => ({ message: 'Lấy danh sách tác giả thành công', data: { items: publicRefs(getCatalog().authors) } }) },
  { method: 'GET', path: '/publishers', handler: () => ({ message: 'Lấy danh sách nhà xuất bản thành công', data: { items: publicRefs(getCatalog().publishers) } }) },
];
