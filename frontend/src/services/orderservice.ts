// services/orderservice.ts
// UC004 - đơn hàng của người dùng: O01 (đặt hàng), O02 (danh sách), O03 (chi tiết), O04 (hủy đơn PENDING).
import type { CheckoutPayload, Order, OrderListResult, OrderQuery } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapOrderDetail, mapOrderList } from './mappers';

export const orderService = {
  // [Gọi API] POST /orders – nút Đặt hàng / Mua ngay (kèm khóa chống gửi trùng).
  // O01: BE tạo đơn từ giỏ hàng trong một transaction (tồn kho, ví, xóa giỏ). Lỗi: VALIDATION_ERROR,
  // EMPTY_CART, OUT_OF_STOCK, INSUFFICIENT_BALANCE.
  async createOrder(p: CheckoutPayload): Promise<Order> {
    const note = p.note.trim();
    const hasItems = !!(p.items && p.items.length);
    // BE: source cart|buy_now cần items; all = cả giỏ và không được gửi items
    const source = p.source ?? (hasItems ? 'cart' : 'all');
    const res = await api.post(ENDPOINTS.orders.root, {
      receiverName: p.receiverName.trim(),
      receiverPhone: p.receiverPhone.trim(),
      shippingAddress: p.shippingAddress.trim(),
      paymentMethod: p.paymentMethod,
      source,
      ...(note ? { note } : {}),
      ...(hasItems ? { items: p.items } : {}),
    });
    return mapOrderDetail(res.data);
  },

  // [Gọi API] GET /orders/my – trang Đơn hàng.
  async getMyOrders(q: OrderQuery = {}): Promise<OrderListResult> {
    // BE enum: CONFIRMED; FE UI: PREPARING
    const status =
      q.status === 'PREPARING' ? 'CONFIRMED' : q.status;
    const res = await api.get(ENDPOINTS.orders.my, { status, page: q.page, limit: q.limit });
    return mapOrderList(res.data);
  },

  // [Gọi API] GET /orders/:id – trang Chi tiết đơn.
  // Chỉ xem được đơn của chính mình; đơn người khác -> 404
  async getOrder(id: number): Promise<Order> {
    return mapOrderDetail((await api.get(ENDPOINTS.orders.detail(id))).data);
  },

  // [Gọi API] PUT /orders/:id/cancel – nút Hủy đơn.
  // Chỉ hủy được đơn PENDING (400 INVALID_STATUS_TRANSITION nếu không)
  async cancelOrder(id: number): Promise<Order> {
    return mapOrderDetail((await api.put(ENDPOINTS.orders.cancel(id))).data);
  },
};
