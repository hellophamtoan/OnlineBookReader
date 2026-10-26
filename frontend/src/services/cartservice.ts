// services/cartservice.ts
// UC004 - giỏ hàng: K01 (xem), K02 (thêm), K03 (sửa số lượng), K04 (xóa dòng), K05 (làm rỗng).
// Mọi API đều trả về TOÀN BỘ giỏ sau thao tác -> CartContext chỉ việc thay state bằng kết quả.
import type { Cart } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapCart } from './mappers';

export const cartService = {
  async getCart(): Promise<Cart> {
    return mapCart((await api.get(ENDPOINTS.cart.root)).data);
  },

  // Sách đã có trong giỏ thì cộng dồn số lượng; tổng không được vượt tồn kho (400 OUT_OF_STOCK)
  async addItem(bookId: number, quantity: number): Promise<Cart> {
    return mapCart((await api.post(ENDPOINTS.cart.root, { bookId, quantity })).data);
  },

  // Đặt số lượng mới (không cộng dồn)
  async updateItem(bookId: number, quantity: number): Promise<Cart> {
    return mapCart((await api.put(ENDPOINTS.cart.item(bookId), { quantity })).data);
  },

  async removeItem(bookId: number): Promise<Cart> {
    return mapCart((await api.delete(ENDPOINTS.cart.item(bookId))).data);
  },

  async clear(): Promise<Cart> {
    return mapCart((await api.delete(ENDPOINTS.cart.root)).data);
  },
};
