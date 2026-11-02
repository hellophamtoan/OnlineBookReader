// UC009 — Admin đơn hàng
// Path khớp Hop_dong_API_OnlineBookReader_UC009_UC010_UC011.xlsx (API-60..64)
// Status khớp backend: PREPARING (hợp đồng ghi CONFIRMED → FE gửi PREPARING)
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import type { OrderStatus, PaymentMethod } from '../../types';
import { normalizeOrderStatus } from '../../utils/adminOrderStatus';

export interface AdminOrderListItem {
  id: number;
  userId: number;
  userFullName: string;
  userEmail: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  totalAmount: number;
  itemCount: number;
  receiverName: string;
  receiverPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrderDetail extends AdminOrderListItem {
  shippingAddress: string;
  note: string | null;
  user: { id: number; fullName: string; email: string; phone: string | null } | null;
  items: { bookId: number; title: string; quantity: number; unitPrice: number; subtotal: number }[];
}

export interface AdminOrderListResult {
  items: AdminOrderListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AdminOrderQuery = {
  page?: number;
  limit?: number;
  status?: string;
  paymentMethod?: string;
  q?: string;
  from?: string;
  to?: string;
};

function pickNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapItem(raw: Record<string, unknown>): AdminOrderListItem {
  const status = normalizeOrderStatus(String(raw.status ?? '')) ?? ('PENDING' as OrderStatus);
  return {
    id: pickNum(raw.id),
    userId: pickNum(raw.userId ?? raw.user_id),
    userFullName: String(raw.userFullName ?? raw.user_full_name ?? raw.fullName ?? '—'),
    userEmail: String(raw.userEmail ?? raw.user_email ?? raw.email ?? '—'),
    status,
    paymentMethod: (String(raw.paymentMethod ?? raw.payment_method ?? 'COD').toUpperCase() as PaymentMethod),
    paymentStatus: String(raw.paymentStatus ?? raw.payment_status ?? 'UNPAID').toUpperCase(),
    totalAmount: pickNum(raw.totalAmount ?? raw.total_amount),
    itemCount: pickNum(raw.itemCount ?? raw.item_count ?? (Array.isArray(raw.items) ? (raw.items as unknown[]).length : 0)),
    receiverName: String(raw.receiverName ?? raw.receiver_name ?? ''),
    receiverPhone: String(raw.receiverPhone ?? raw.receiver_phone ?? ''),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

function mapDetail(raw: Record<string, unknown>): AdminOrderDetail {
  const base = mapItem(raw);
  const userRaw = (raw.user as Record<string, unknown> | null | undefined) ?? null;
  const itemsRaw = Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [];
  return {
    ...base,
    shippingAddress: String(raw.shippingAddress ?? raw.shipping_address ?? ''),
    note: (raw.note as string | null) ?? null,
    user: userRaw
      ? {
          id: pickNum(userRaw.id),
          fullName: String(userRaw.fullName ?? userRaw.full_name ?? ''),
          email: String(userRaw.email ?? ''),
          phone: (userRaw.phone as string | null) ?? null,
        }
      : null,
    items: itemsRaw.map((it) => ({
      bookId: pickNum(it.bookId ?? it.book_id),
      title: String(it.title ?? it.book_title ?? it.bookTitle ?? ''),
      quantity: pickNum(it.quantity),
      unitPrice: pickNum(it.unitPrice ?? it.unit_price),
      subtotal: pickNum(it.subtotal),
    })),
  };
}

function normalizeList(raw: unknown): AdminOrderListResult {
  const d = (raw ?? {}) as Record<string, unknown>;
  const arr = (Array.isArray(d.items) ? d.items : Array.isArray(raw) ? raw : []) as Record<string, unknown>[];
  const items = arr.map(mapItem);
  const page = pickNum(d.page, 1) || 1;
  const limit = pickNum(d.limit, items.length || 20) || 20;
  const total = pickNum(d.total, items.length) || items.length;
  const totalPages = pickNum(d.totalPages ?? d.total_pages, Math.max(1, Math.ceil(total / limit))) || 1;
  return { items, page, limit, total, totalPages };
}

export const orderAdminService = {
  async list(q: AdminOrderQuery = {}): Promise<AdminOrderListResult> {
    // Query status: luôn gửi enum BE (PREPARING), không gửi CONFIRMED
    const status = q.status ? normalizeOrderStatus(q.status) ?? q.status : undefined;
    const data = (
      await api.get(ENDPOINTS.admin.orders.root, {
        ...q,
        status,
      } as Record<string, string | number | undefined>)
    ).data;
    return normalizeList(data);
  },

  async get(id: number): Promise<AdminOrderDetail> {
    const data = (await api.get(ENDPOINTS.admin.orders.detail(id))).data as Record<string, unknown>;
    return mapDetail(data);
  },

  async updateStatus(id: number, status: OrderStatus | string, note?: string) {
    const normalized = normalizeOrderStatus(String(status)) ?? (status as OrderStatus);
    return (
      await api.patch(ENDPOINTS.admin.orders.status(id), { status: normalized, note })
    ).data as { id: number; status: OrderStatus; paymentStatus: string; updatedAt: string };
  },

  /** API-63: xác nhận = PENDING → PREPARING (không gửi CONFIRMED) */
  async confirm(id: number) {
    return (await api.post(ENDPOINTS.admin.orders.confirm(id), {})).data as {
      id: number;
      status: OrderStatus;
      updatedAt: string;
    };
  },

  async cancel(id: number, reason?: string) {
    const data = (await api.post(ENDPOINTS.admin.orders.cancel(id), { reason })).data as Record<string, unknown>;
    // Một số BE trả object rút gọn — cố map detail nếu đủ field
    if (data && (data.items || data.receiverName || data.receiver_name)) return mapDetail(data);
    return data as unknown as AdminOrderDetail;
  },
};
