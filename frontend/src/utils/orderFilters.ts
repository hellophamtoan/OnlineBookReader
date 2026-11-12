// utils/orderFilters.ts
// Bộ lọc của trang "Đơn hàng của tôi" lưu trên URL (?status=PENDING&page=2), cùng cách làm với bookFilters.ts.
import { ORDER_STATUSES } from '../config/orders';
import type { OrderQuery, OrderStatus } from '../types';

export interface OrderFilterState {
  status?: OrderStatus;
  page: number;
}

// [Xử lý] Đọc bộ lọc đơn hàng từ URL.
export const parseOrderFilters = (sp: URLSearchParams): OrderFilterState => {
  const status = sp.get('status');
  const page = Number(sp.get('page'));
  return {
    status: ORDER_STATUSES.some((s) => s.value === status) ? (status as OrderStatus) : undefined,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
};

// [Xử lý] Cập nhật bộ lọc đơn lên URL.
// Đổi trạng thái thì quay về trang 1
export const patchOrderParams = (sp: URLSearchParams, patch: { status?: OrderStatus | ''; page?: number }) => {
  const next = new URLSearchParams(sp);
  if ('status' in patch) {
    if (patch.status) next.set('status', patch.status);
    else next.delete('status');
    next.delete('page');
  }
  if ('page' in patch) {
    if (patch.page && patch.page > 1) next.set('page', String(patch.page));
    else next.delete('page');
  }
  return next;
};

// [Xử lý] Đổi bộ lọc thành tham số API.
export const toOrderQuery = (f: OrderFilterState, limit: number): OrderQuery => ({ status: f.status, page: f.page, limit });
