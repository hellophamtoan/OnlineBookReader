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
  balanceAfter: number | null; // số dư ví sau giao dịch
  note: string | null; // ghi chú admin / nội dung nạp
  refType: string | null;
  refId: number | null;
  externalReference: string | null;
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
  writeJson(TX_KEY, [{
    balanceAfter: null,
    note: null,
    externalReference: null,
    ...tx,
    id: all.length + 1,
    createdAt: new Date().toISOString(),
  }, ...all]);
};

/**
 * Cộng/trừ ví theo số dư hiện tại (getWallet) rồi ghi lịch sử.
 * amount > 0 = nạp, amount < 0 = trừ.
 */
export const adjustWallet = (
  user: MockUser,
  amount: number,
  meta: {
    type?: WalletTxType;
    refType?: string | null;
    refId?: number | null;
    note?: string | null;
    externalReference?: string | null;
  } = {},
) => {
  const balance = getWallet(user) + amount;
  if (balance < 0) throw new Error('INSUFFICIENT_BALANCE');
  setWallet(user.id, balance);
  addWalletTx({
    userId: user.id,
    type: meta.type ?? (amount >= 0 ? 'TOPUP' : 'PAY_ORDER'),
    amount,
    balanceAfter: balance,
    note: meta.note ?? null,
    refType: meta.refType ?? null,
    refId: meta.refId ?? null,
    externalReference: meta.externalReference ?? null,
  });
  return balance;
};

// ---------- Yêu cầu nạp ví (VNPay/MoMo/DEMO mock) ----------
export type TopupGateway = 'VNPAY' | 'MOMO' | 'DEMO' | 'BANK_QR';
export type TopupStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface MockTopupRequest {
  id: number;
  userId: number;
  amount: number;
  gateway: TopupGateway;
  status: TopupStatus;
  orderCode: string;
  gatewayTxnId: string | null;
  paymentUrl: string;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
}

const TOPUP_KEY = 'mock_wallet_topups';
export const allTopups = () => readJson<MockTopupRequest[]>(TOPUP_KEY, []);
export const saveTopups = (list: MockTopupRequest[]) => writeJson(TOPUP_KEY, list);

export const findTopupByCode = (orderCode: string) =>
  allTopups().find((t) => t.orderCode === orderCode);

export const createTopupRequest = (
  data: Omit<MockTopupRequest, 'id' | 'createdAt' | 'paidAt' | 'status' | 'gatewayTxnId'> & {
    status?: TopupStatus;
  },
): MockTopupRequest => {
  const list = allTopups();
  const row: MockTopupRequest = {
    id: list.reduce((m, t) => Math.max(m, t.id), 0) + 1,
    userId: data.userId,
    amount: data.amount,
    gateway: data.gateway,
    status: data.status ?? 'PENDING',
    orderCode: data.orderCode,
    gatewayTxnId: null,
    paymentUrl: data.paymentUrl,
    note: data.note ?? null,
    paidAt: null,
    createdAt: new Date().toISOString(),
  };
  saveTopups([row, ...list]);
  return row;
};

export const updateTopup = (orderCode: string, patch: Partial<MockTopupRequest>) => {
  const list = allTopups();
  const i = list.findIndex((t) => t.orderCode === orderCode);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  saveTopups(list);
  return list[i];
};


// ---------- Tài khoản nhận tiền cửa hàng (admin) ----------
const STORE_BANK_KEY = 'mock_store_bank';
export interface StoreBank {
  bin: string;
  accountNo: string;
  accountName: string;
  bankName: string;
  /** Ảnh QR do admin chọn (data URL hoặc URL) — user nạp ví hiển thị ảnh này */
  qrImageUrl: string | null;
}
const DEFAULT_STORE_BANK: StoreBank = {
  bin: '970422', // MB Bank
  accountNo: '0989807884',
  accountName: 'NGUYEN VAN HA',
  bankName: 'MB Bank',
  qrImageUrl: null,
};
export const getStoreBank = (): StoreBank => {
  const raw = readJson<Partial<StoreBank> | null>(STORE_BANK_KEY, null);
  if (!raw) return { ...DEFAULT_STORE_BANK };
  return {
    bin: raw.bin || DEFAULT_STORE_BANK.bin,
    accountNo: raw.accountNo || DEFAULT_STORE_BANK.accountNo,
    accountName: raw.accountName || DEFAULT_STORE_BANK.accountName,
    bankName: raw.bankName || DEFAULT_STORE_BANK.bankName,
    qrImageUrl: raw.qrImageUrl ?? null,
  };
};
export const setStoreBank = (b: StoreBank) => writeJson(STORE_BANK_KEY, b);

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

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface MockOrder {
  id: number;
  userId: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  /** Khớp BE: WALLET lúc tạo = PAID; COD = UNPAID; hủy đã trừ ví = REFUNDED */
  paymentStatus: PaymentStatus;
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
const seed = (
  id: number,
  status: OrderStatus,
  pm: PaymentMethod,
  day: string,
  lines: CartLine[],
  note: string | null = null,
  paymentStatus?: PaymentStatus,
): MockOrder => {
  const items = toOrderItems(lines);
  const ps: PaymentStatus =
    paymentStatus ??
    (pm === 'WALLET' ? (status === 'CANCELLED' || status === 'FAILED' ? 'REFUNDED' : 'PAID') : 'UNPAID');
  return {
    id,
    userId: 2,
    status,
    paymentMethod: pm,
    paymentStatus: ps,
    note,
    totalAmount: items.reduce((s, i) => s + i.subtotal, 0),
    receiverName: 'Nguyễn Văn An',
    receiverPhone: '0912345678',
    shippingAddress: '12 Phố Huế, Hai Bà Trưng, Hà Nội',
    createdAt: `${day}T10:00:00.000Z`,
    updatedAt: `${day}T10:00:00.000Z`,
    items,
  };
};

const SEED_ORDERS: MockOrder[] = [
  seed(1, 'DELIVERED', 'COD', '2026-09-20', [{ bookId: 1, quantity: 1 }, { bookId: 2, quantity: 2 }]),
  seed(2, 'SHIPPING', 'WALLET', '2026-10-08', [{ bookId: 11, quantity: 1 }, { bookId: 3, quantity: 1 }]),
  seed(3, 'CANCELLED', 'COD', '2026-10-09', [{ bookId: 9, quantity: 1 }]),
  seed(4, 'FAILED', 'COD', '2026-10-10', [{ bookId: 4, quantity: 2 }]),
  seed(5, 'PENDING', 'COD', '2026-10-12', [{ bookId: 1, quantity: 1 }, { bookId: 2, quantity: 2 }], 'Giao giờ hành chính'),
  seed(6, 'PREPARING', 'WALLET', '2026-10-15', [{ bookId: 2, quantity: 1 }]),
  seed(7, 'PENDING', 'WALLET', '2026-10-20', [{ bookId: 3, quantity: 1 }], 'Giao buổi tối'),
];

const ORDERS_KEY = 'mock_orders_v2';
export const allOrders = () => readJson<MockOrder[]>(ORDERS_KEY, SEED_ORDERS);
export const saveOrders = (orders: MockOrder[]) => writeJson(ORDERS_KEY, orders);
export const nextOrderId = () => Math.max(0, ...allOrders().map((o) => o.id)) + 1;

// Bỏ userId trước khi trả ra ngoài (BE thật không lộ trường này ở API người dùng)
export const publicOrder = ({ userId: _userId, ...order }: MockOrder) => order;
