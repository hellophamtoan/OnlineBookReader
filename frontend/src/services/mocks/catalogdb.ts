// services/mocks/catalogdb.ts
// "CSDL" giả cho DANH MỤC & KHO SÁCH (UC007): sách, tác giả, thể loại, NXB. Khởi tạo từ data.ts, lưu localStorage (khóa mock_catalog).
// Đây là NGUỒN DUY NHẤT: API công khai (books.ts), giỏ hàng/đơn hàng (shopdb.ts) và API quản trị (adminBooks.ts...) cùng đọc ở đây,
// nên Admin sửa sách/tồn kho thì trang người dùng thấy ngay.
import { MOCK_AUTHORS, MOCK_BOOKS, MOCK_CATEGORIES, MOCK_PUBLISHERS } from './data';
import { readJson, writeJson } from './storage';

export type EntityStatus = 'active' | 'inactive';
export type RefKind = 'categories' | 'authors' | 'publishers';

export interface CatalogRef {
  id: number;
  name: string;
  status: EntityStatus;
  bio?: string; // chỉ tác giả
}

export interface CatalogBook {
  id: number;
  title: string;
  description: string;
  coverUrl: string | null;
  publisherId: number | null;
  hasPhysical: boolean;
  hasEbook: boolean;
  price: number | null; // null = chỉ e-book
  stock: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
  authorIds: number[];
  categoryIds: number[];
}

export interface CatalogState {
  books: CatalogBook[];
  categories: CatalogRef[];
  authors: CatalogRef[];
  publishers: CatalogRef[];
}

const KEY = 'mock_catalog';

const seed = (): CatalogState => ({
  categories: MOCK_CATEGORIES.map((c) => ({ ...c, status: 'active' as const })),
  authors: MOCK_AUTHORS.map((a) => ({ ...a, bio: '', status: 'active' as const })),
  publishers: MOCK_PUBLISHERS.map((p) => ({ ...p, status: 'active' as const })),
  books: MOCK_BOOKS.map((b): CatalogBook => ({
    id: b.id,
    title: b.title,
    description: b.description,
    coverUrl: null,
    publisherId: b.publisherId,
    hasPhysical: b.hasPhysical,
    hasEbook: b.hasEbook,
    price: b.price,
    stock: b.stock,
    status: b.status,
    createdAt: b.createdAt,
    updatedAt: b.createdAt,
    authorIds: [b.authorId],
    categoryIds: [b.categoryId],
  })),
});

export const getCatalog = (): CatalogState => readJson<CatalogState>(KEY, seed());

// Đọc -> sửa -> ghi lại toàn bộ (dữ liệu nhỏ nên làm vậy cho đơn giản)
export const updateCatalog = (mutate: (state: CatalogState) => CatalogState) => writeJson(KEY, mutate(getCatalog()));

export const findCatalogBook = (id: number): CatalogBook | undefined => getCatalog().books.find((b) => b.id === id);

export const setCatalogStock = (bookId: number, value: number) =>
  updateCatalog((s) => ({ ...s, books: s.books.map((b) => (b.id === bookId ? { ...b, stock: Math.max(0, value) } : b)) }));

export const nextId = (list: { id: number }[]) => Math.max(0, ...list.map((x) => x.id)) + 1;
