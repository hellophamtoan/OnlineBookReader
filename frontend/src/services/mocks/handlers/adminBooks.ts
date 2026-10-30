// services/mocks/handlers/adminBooks.ts
// Giả lập API-26..API-30 (UC007 quản lý sách): danh sách, chi tiết, thêm, sửa, xóa mềm. Chỉ ADMIN.
import { normalizeText } from '../../../utils/text';
import { ADMIN } from '../../../config/admin';
import { chaptersOf } from '../chapterdb';
import { getCatalog, nextId, updateCatalog } from '../catalogdb';
import type { CatalogBook, CatalogRef, EntityStatus } from '../catalogdb';
import type { Route } from '../router';
import { badRequest, failValidation, idParam, notFound, str, toNumber } from './common';
import type { FieldErr } from './common';
import { requireAdmin } from './guards';

const isStatus = (v: unknown): v is EntityStatus => v === 'active' || v === 'inactive';
const refView = (r: CatalogRef) => ({ id: r.id, name: r.name, status: r.status });

const detail = (b: CatalogBook) => {
  const c = getCatalog();
  const pick = (list: CatalogRef[], ids: number[]) => ids.map((id) => list.find((r) => r.id === id)).filter((r): r is CatalogRef => !!r).map(refView);
  return {
    id: b.id, title: b.title, description: b.description, coverUrl: b.coverUrl, publisherId: b.publisherId,
    hasPhysical: b.hasPhysical, hasEbook: b.hasEbook, price: b.price, stock: b.stock, status: b.status,
    createdAt: b.createdAt, updatedAt: b.updatedAt,
    authors: pick(c.authors, b.authorIds), categories: pick(c.categories, b.categoryIds),
  };
};

const listItem = (b: CatalogBook) => ({
  id: b.id, title: b.title, coverUrl: b.coverUrl, hasPhysical: b.hasPhysical, hasEbook: b.hasEbook,
  price: b.price, stock: b.stock, status: b.status, createdAt: b.createdAt, chapterCount: chaptersOf(b.id).length,
});

// Body chung của API-28 / API-29. Sách giấy: price >= 0 và stock nguyên >= 0 bắt buộc; chỉ e-book: price = null, stock = 0.
const parseBook = (body: unknown, isUpdate: boolean) => {
  const b = (body ?? {}) as Record<string, unknown>;
  const c = getCatalog();
  const errors: FieldErr[] = [];

  const title = str(b.title).trim();
  if (!title) errors.push({ field: 'title', message: 'Vui lòng nhập tên sách' });
  else if (title.length > ADMIN.TITLE_MAX) errors.push({ field: 'title', message: `Tên sách tối đa ${ADMIN.TITLE_MAX} ký tự` });

  const coverUrl = str(b.coverUrl).trim();
  if (coverUrl) {
    const okPath = /^(https?:\/\/\S+|\/uploads\/\S+)/i.test(coverUrl);
    const okData = /^data:image\//i.test(coverUrl) && coverUrl.length <= ADMIN.COVER_MAX;
    if (!okPath && !okData) {
      errors.push({
        field: 'coverUrl',
        message: 'Ảnh bìa phải là http(s)://, /uploads/... hoặc ảnh từ EPUB/máy (data:image)',
      });
    }
  }

  let publisherId: number | null = null;
  if (b.publisherId !== undefined && b.publisherId !== null && b.publisherId !== '') {
    const id = toNumber(b.publisherId);
    if (!Number.isInteger(id) || !c.publishers.some((p) => p.id === id)) errors.push({ field: 'publisherId', message: 'Nhà xuất bản không tồn tại' });
    else publisherId = id;
  }

  if (typeof b.hasPhysical !== 'boolean' || typeof b.hasEbook !== 'boolean') errors.push({ field: 'hasPhysical', message: 'hasPhysical và hasEbook phải là true/false' });
  else if (!b.hasPhysical && !b.hasEbook) errors.push({ field: 'hasPhysical', message: 'Chọn ít nhất một hình thức: sách giấy hoặc e-book' });
  const hasPhysical = b.hasPhysical === true;
  const hasEbook = b.hasEbook === true;

  let price: number | null = null;
  let stock = 0;
  if (hasPhysical) {
    price = toNumber(b.price);
    stock = toNumber(b.stock);
    if (!Number.isFinite(price) || price < 0) errors.push({ field: 'price', message: 'Giá phải là số không âm' });
    if (!Number.isInteger(stock) || stock < 0) errors.push({ field: 'stock', message: 'Tồn kho phải là số nguyên không âm' });
  }

  const idList = (v: unknown, pool: CatalogRef[], field: string, label: string): number[] => {
    const ids = Array.isArray(v) ? v.map(toNumber) : [];
    if (ids.length === 0) errors.push({ field, message: `Chọn ít nhất một ${label}` });
    else if (ids.some((id) => !Number.isInteger(id) || !pool.some((r) => r.id === id))) errors.push({ field, message: `${label[0].toUpperCase()}${label.slice(1)} không tồn tại` });
    return [...new Set(ids)];
  };
  const authorIds = idList(b.authorIds, c.authors, 'authorIds', 'tác giả');
  const categoryIds = idList(b.categoryIds, c.categories, 'categoryIds', 'thể loại');

  if (isUpdate && b.status !== undefined && b.status !== null && !isStatus(b.status)) errors.push({ field: 'status', message: 'Trạng thái không hợp lệ' });

  if (errors.length) throw failValidation(errors);
  return {
    title, description: str(b.description).trim(), coverUrl: coverUrl || null, publisherId, hasPhysical, hasEbook,
    price: hasPhysical ? price : null, stock: hasPhysical ? stock : 0, authorIds, categoryIds,
    status: isUpdate && isStatus(b.status) ? b.status : undefined,
  };
};

const bookOr404 = (id: number) => {
  const book = getCatalog().books.find((x) => x.id === id);
  if (!book) throw notFound('Không tìm thấy sách');
  return book;
};

export const adminBookRoutes: Route[] = [
  // ===== API-26 GET /admin/books =====
  {
    method: 'GET',
    path: '/admin/books',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const status = query.get('status');
      if (status !== null && status !== '' && !isStatus(status)) throw badRequest('status không hợp lệ');
      const page = Number(query.get('page') ?? 1);
      const limit = Number(query.get('limit') ?? ADMIN.PAGE_SIZE);
      if (!Number.isInteger(page) || page < 1) throw badRequest('page không hợp lệ');
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw badRequest('limit không hợp lệ');

      const kw = normalizeText(query.get('search') ?? '');
      const list = getCatalog().books
        .filter((b) => (!status || b.status === status) && (!kw || normalizeText(b.title).includes(kw)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
      return {
        message: 'Lấy danh sách sách thành công',
        data: { items: list.slice((page - 1) * limit, page * limit).map(listItem), page, limit, total: list.length },
      };
    },
  },

  // ===== API-27 GET /admin/books/:id =====
  {
    method: 'GET',
    path: '/admin/books/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      return { message: 'Lấy chi tiết sách thành công', data: detail(bookOr404(idParam(params.id))) };
    },
  },

  // ===== API-28 POST /admin/books =====
  {
    method: 'POST',
    path: '/admin/books',
    handler: ({ token, body }) => {
      requireAdmin(token);
      const p = parseBook(body, false);
      const now = new Date().toISOString();
      let created!: CatalogBook;
      updateCatalog((s) => {
        created = {
          id: nextId(s.books), title: p.title, description: p.description, coverUrl: p.coverUrl, publisherId: p.publisherId,
          hasPhysical: p.hasPhysical, hasEbook: p.hasEbook, price: p.price, stock: p.stock, status: 'active',
          createdAt: now, updatedAt: now, authorIds: p.authorIds, categoryIds: p.categoryIds,
        };
        return { ...s, books: [...s.books, created] };
      });
      return { status: 201, message: 'Thêm sách thành công', data: detail(created) };
    },
  },

  // ===== API-29 PUT /admin/books/:id =====
  {
    method: 'PUT',
    path: '/admin/books/:id',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const id = idParam(params.id);
      const current = bookOr404(id);
      const p = parseBook(body, true);
      const next: CatalogBook = {
        ...current, title: p.title, description: p.description, coverUrl: p.coverUrl, publisherId: p.publisherId,
        hasPhysical: p.hasPhysical, hasEbook: p.hasEbook, price: p.price, stock: p.stock,
        authorIds: p.authorIds, categoryIds: p.categoryIds, status: p.status ?? current.status, updatedAt: new Date().toISOString(),
      };
      updateCatalog((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? next : b)) }));
      return { message: 'Cập nhật sách thành công', data: detail(next) };
    },
  },

  // ===== API-30 DELETE /admin/books/:id ===== xóa mềm
  {
    method: 'DELETE',
    path: '/admin/books/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = idParam(params.id);
      bookOr404(id);
      updateCatalog((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? { ...b, status: 'inactive' as const, updatedAt: new Date().toISOString() } : b)) }));
      return { message: 'Đã chuyển sách sang ngừng hoạt động', data: null };
    },
  },

];
