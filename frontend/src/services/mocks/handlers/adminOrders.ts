// UC009 — Admin quản lý đơn hàng (API-60..64)
import { ORDER_STATUSES } from '../../../config/orders';
import type { OrderStatus } from '../../../types';
import { ADMIN_ORDER_NEXT } from '../../../utils/adminOrderStatus';
import { MockHttpError, toInt } from '../http';
import type { Route } from '../router';
import { findUserById } from '../db';
import {
  adjustWallet,
  allOrders,
  findBook,
  getStock,
  saveOrders,
  setStock,
  type MockOrder,
} from '../shopdb';
import { paginate } from './common';
import { requireAdmin } from './guards';

const validation = (message: string, field?: string) =>
  new MockHttpError(400, message, 'VALIDATION_ERROR', field ? [{ field, message }] : undefined);

/** Ưu tiên paymentStatus đã lưu (khớp BE); fallback suy luận cho dữ liệu cũ */
export const paymentStatusOf = (o: MockOrder): 'PAID' | 'UNPAID' | 'REFUNDED' => {
  if (o.paymentStatus) return o.paymentStatus;
  if (o.paymentMethod !== 'WALLET') return 'UNPAID';
  if (o.status === 'CANCELLED' || o.status === 'FAILED') return 'REFUNDED';
  return 'PAID';
};

function restoreStock(order: MockOrder) {
  for (const it of order.items) {
    const b = findBook(it.bookId);
    if (b) setStock(it.bookId, getStock(b) + it.quantity);
  }
}

function refundWalletIfNeeded(order: MockOrder): MockOrder {
  if (paymentStatusOf(order) !== 'PAID' || order.paymentMethod !== 'WALLET') return order;
  const user = findUserById(order.userId);
  if (!user) return order;
  adjustWallet(user, order.totalAmount, {
    type: 'REFUND',
    refType: 'ORDER',
    refId: order.id,
  });
  return { ...order, paymentStatus: 'REFUNDED' };
}

function listItem(o: MockOrder) {
  const u = findUserById(o.userId);
  return {
    id: o.id,
    userId: o.userId,
    userFullName: u?.fullName ?? '—',
    userEmail: u?.email ?? '—',
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: paymentStatusOf(o),
    totalAmount: o.totalAmount,
    itemCount: o.items.length,
    receiverName: o.receiverName,
    receiverPhone: o.receiverPhone,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function detail(o: MockOrder) {
  const u = findUserById(o.userId);
  return {
    ...listItem(o),
    shippingAddress: o.shippingAddress,
    note: o.note,
    user: u
      ? { id: u.id, fullName: u.fullName, email: u.email, phone: u.phone ?? null }
      : null,
    items: o.items,
  };
}

function applyStatus(order: MockOrder, next: OrderStatus, _note?: string): MockOrder {
  if (!ADMIN_ORDER_NEXT[order.status].includes(next)) {
    throw new MockHttpError(
      409,
      `Không thể chuyển từ ${order.status} sang ${next}`,
      'INVALID_STATUS_TRANSITION',
    );
  }
  let updated: MockOrder = { ...order, status: next, updatedAt: new Date().toISOString() };
  if (next === 'CANCELLED' || next === 'FAILED') {
    restoreStock(order);
    updated = refundWalletIfNeeded(updated);
  }
  return updated;
}

export const adminOrderRoutes: Route[] = [
  {
    method: 'GET',
    path: '/admin/orders',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const page = Math.max(1, toInt(query.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, toInt(query.get('limit')) || 20));
      let status = query.get('status') || '';
      if (status.toUpperCase() === 'CONFIRMED') status = 'PREPARING';
      const paymentMethod = query.get('paymentMethod') || '';
      const q = (query.get('q') || '').trim().toLowerCase();
      const from = query.get('from') || '';
      const to = query.get('to') || '';

      if (status && !ORDER_STATUSES.some((s) => s.value === status)) {
        throw validation('status không hợp lệ', 'status');
      }

      let list = allOrders();
      if (status) list = list.filter((o) => o.status === status);
      if (paymentMethod) list = list.filter((o) => o.paymentMethod === paymentMethod);
      if (from) list = list.filter((o) => o.createdAt.slice(0, 10) >= from);
      if (to) list = list.filter((o) => o.createdAt.slice(0, 10) <= to);
      if (q) {
        list = list.filter((o) => {
          const u = findUserById(o.userId);
          return (
            String(o.id).includes(q) ||
            o.receiverName.toLowerCase().includes(q) ||
            o.receiverPhone.includes(q) ||
            (u?.email ?? '').toLowerCase().includes(q) ||
            (u?.fullName ?? '').toLowerCase().includes(q)
          );
        });
      }
      list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const pageData = paginate(list, page, limit);
      return {
        message: 'Lấy danh sách đơn hàng thành công',
        data: {
          items: pageData.items.map(listItem),
          page,
          limit,
          total: pageData.total,
          totalPages: pageData.totalPages,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/admin/orders/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const order = allOrders().find((o) => o.id === id);
      if (!order) throw new MockHttpError(404, 'Không tìm thấy đơn hàng', 'NOT_FOUND');
      return { message: 'OK', data: detail(order) };
    },
  },
  {
    method: 'PATCH',
    path: '/admin/orders/:id/status',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const list = allOrders();
      const idx = list.findIndex((o) => o.id === id);
      if (idx < 0) throw new MockHttpError(404, 'Không tìm thấy đơn hàng', 'NOT_FOUND');
      const b = (body ?? {}) as Record<string, unknown>;
      let statusRaw = String(b.status || '');
      if (statusRaw.toUpperCase() === 'CONFIRMED') statusRaw = 'PREPARING'; // hợp đồng API-62
      const status = statusRaw as OrderStatus;
      if (!ORDER_STATUSES.some((s) => s.value === status)) throw validation('status không hợp lệ', 'status');
      const note = b.note != null ? String(b.note) : undefined;
      const updated = applyStatus(list[idx], status, note);
      list[idx] = updated;
      saveOrders(list);
      return {
        message: 'Đã cập nhật trạng thái đơn',
        data: {
          id: updated.id,
          status: updated.status,
          paymentStatus: paymentStatusOf(updated),
          updatedAt: updated.updatedAt,
        },
      };
    },
  },
  {
    method: 'POST',
    path: '/admin/orders/:id/confirm',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const list = allOrders();
      const idx = list.findIndex((o) => o.id === id);
      if (idx < 0) throw new MockHttpError(404, 'Không tìm thấy đơn hàng', 'NOT_FOUND');
      const updated = applyStatus(list[idx], 'PREPARING');
      list[idx] = updated;
      saveOrders(list);
      return { message: 'Đã xác nhận đơn', data: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt } };
    },
  },
  {
    method: 'POST',
    path: '/admin/orders/:id/cancel',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const list = allOrders();
      const idx = list.findIndex((o) => o.id === id);
      if (idx < 0) throw new MockHttpError(404, 'Không tìm thấy đơn hàng', 'NOT_FOUND');
      const reason = body && typeof body === 'object' ? String((body as { reason?: string }).reason ?? '') : '';
      const updated = applyStatus(list[idx], 'CANCELLED', reason || undefined);
      list[idx] = updated;
      saveOrders(list);
      return { message: 'Đã hủy đơn', data: detail(updated) };
    },
  },
];
