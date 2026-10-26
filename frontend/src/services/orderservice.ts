// services/orderservice.ts
// UC004 - đơn hàng của người dùng: O01 (đặt hàng), O02 (danh sách), O03 (chi tiết), O04 (hủy đơn PENDING).
import type { CheckoutPayload, Order, OrderListResult, OrderQuery } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapOrderDetail, mapOrderList } from './mappers';

export const orderService = {
  // O01: BE tạo đơn từ giỏ hàng trong một transaction (tồn kho, ví, xóa giỏ). Lỗi: VALIDATION_ERROR,
  // EMPTY_CART, OUT_OF_STOCK, INSUFFICIENT_BALANCE.
  async createOrder(p: CheckoutPayload): Promise<Order> {
    const note = p.note.trim();
    const res = await api.post(ENDPOINTS.orders.root, {
      receiverName: p.receiverName.trim(),
      receiverPhone: p.receiverPhone.trim(),
      shippingAddress: p.shippingAddress.trim(),
      paymentMethod: p.paymentMethod,
      ...(note ? { note } : {}),
    });
    return mapOrderDetail(res.data);
  },

  async getMyOrders(q: OrderQuery = {}): Promise<OrderListResult> {
    const res = await api.get(ENDPOINTS.orders.my, { status: q.status, page: q.page, limit: q.limit });
    return mapOrderList(res.data);
  },

  // Chỉ xem được đơn của chính mình; đơn người khác -> 404
  async getOrder(id: number): Promise<Order> {
    return mapOrderDetail((await api.get(ENDPOINTS.orders.detail(id))).data);
  },

  // Chỉ hủy được đơn PENDING (400 INVALID_STATUS_TRANSITION nếu không)
  async cancelOrder(id: number): Promise<Order> {
    return mapOrderDetail((await api.put(ENDPOINTS.orders.cancel(id))).data);
  },
};
