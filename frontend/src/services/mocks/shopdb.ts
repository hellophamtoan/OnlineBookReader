// services/mocks/shopdb.ts
// "CSDL" giả cho nghiệp vụ mua hàng: giỏ hàng, đơn hàng, tồn kho, ví.
// UC009 (quản trị đơn hàng), UC005 (gói đọc trừ ví), UC012 (ví của tôi) dùng lại các hàm ở đây để dữ liệu nhất quán.
import type { OrderStatus, PaymentMethod } from '../../types';
import { findCatalogBook, setCatalogStock } from './catalogdb';
import type { CatalogBook } from './catalogdb';
import type { MockUser } from './db';
import { readJson, writeJson } from './storage';

// ---------- Sách & tồn kho ----------
// Sách và tồn kho nằm ở catalogdb.ts (UC007 quản lý chung nguồn này), shopdb chỉ ủy quyền để giữ nguyên các nơi gọi cũ.
export const findBook = (id: number): CatalogBook | undefined => findCatalogBook(id);
export const getStock = (b: Pick<CatalogBook, 'stock'>) => b.stock;
export const setStock = (bookId: number, value: number) => setCatalogStock(bookId, value);

// ---------- Ví ----------
export type WalletTxType = 'TOPUP' | 'PAY_ORDER' | 'PAY_PLAN' | 'REFUND';
export interface WalletTx {
  id: number;
  userId: number;
  type: WalletTxType;
  amount: number; // dương: cộng ví, âm: trừ ví
  refType: string | null;
  refId: number | null;
  createdAt: string;
}

const WALLET_KEY = 'mock_wallets';
const TX_KEY = 'mock_wallet_tx';
const walletOverrides = () => readJson<Record<string, number>>(WALLET_KEY, {});
export const getWallet = (u: MockUser) => walletOverrides()[u.id] ?? u.walletBalance ?? 0;
export const setWallet = (userId: number, value: number) => writeJson(WALLET_KEY, { ...walletOverrides(), [userId]: value });

export const walletTransactions = (userId: number) => readJson<WalletTx[]>(TX_KEY, []).filter((t) => t.userId === userId);
export const addWalletTx = (tx: Omit<WalletTx, 'id' | 'createdAt'>) => {
  const all = readJson<WalletTx[]>(TX_KEY, []);
  writeJson(TX_KEY, [{ ...tx, id: all.length + 1, createdAt: new Date().toISOString() }, ...all]);
};

// ---------- Giỏ hàng ----------
export interface CartLine {
  bookId: number;
  quantity: number;
}

const CARTS_KEY = 'mock_carts';
const allCarts = () => readJson<Record<string, CartLine[]>>(CARTS_KEY, {});
export const getCartLines = (userId: number): CartLine[] => allCarts()[userId] ?? [];
export const saveCartLines = (userId: number, lines: CartLine[]) => writeJson(CARTS_KEY, { ...allCarts(), [userId]: lines });

// ---------- Đơn hàng ----------
export interface MockOrderItem {
  bookId: number;
  title: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface MockOrder {
  id: number;
  userId: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  receiverName: string;
  receiverPhone: string;
  shippingAddress: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: MockOrderItem[];
}

export const toOrderItems = (lines: CartLine[]): MockOrderItem[] =>
  lines.map((l) => {
    const b = findBook(l.bookId);
    const unitPrice = b?.price ?? 0;
    return { bookId: l.bookId, title: b?.title ?? '', quantity: l.quantity, unitPrice, subtotal: unitPrice * l.quantity };
  });

// Đơn mẫu của user1 (id 2) để thấy đủ trạng thái, bộ lọc và nút "Hủy đơn" (chỉ đơn PENDING)
const seed = (id: number, status: OrderStatus, pm: PaymentMethod, day: string, lines: CartLine[], note: string | null = null): MockOrder => {
  const items = toOrderItems(lines);
  return {
    id, userId: 2, status, paymentMethod: pm, note,
    totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
    receiverName: 'Nguyễn Văn An', receiverPhone: '0912345678', shippingAddress: '12 Phố Huế, Hai Bà Trưng, Hà Nội',
    createdAt: `${day}T10:00:00.000Z`, updatedAt: `${day}T10:00:00.000Z`, items,
  };
};

const SEED_ORDERS: MockOrder[] = [
  seed(1, 'DELIVERED', 'COD', '2026-09-20', [{ bookId: 1, quantity: 1 }, { bookId: 2, quantity: 2 }]),
  seed(2, 'SHIPPING', 'WALLET', '2026-10-08', [{ bookId: 11, quantity: 1 }, { bookId: 3, quantity: 1 }]),
  seed(3, 'CANCELLED', 'COD', '2026-10-09', [{ bookId: 9, quantity: 1 }]),
  seed(4, 'FAILED', 'COD', '2026-10-10', [{ bookId: 4, quantity: 2 }]),
  seed(5, 'PENDING', 'COD', '2026-10-12', [{ bookId: 1, quantity: 1 }, { bookId: 2, quantity: 2 }], 'Giao giờ hành chính'),
];

const ORDERS_KEY = 'mock_orders';
export const allOrders = () => readJson<MockOrder[]>(ORDERS_KEY, SEED_ORDERS);
export const saveOrders = (orders: MockOrder[]) => writeJson(ORDERS_KEY, orders);
export const nextOrderId = () => Math.max(0, ...allOrders().map((o) => o.id)) + 1;

// Bỏ userId trước khi trả ra ngoài (BE thật không lộ trường này ở API người dùng)
export const publicOrder = ({ userId: _userId, ...order }: MockOrder) => order;
