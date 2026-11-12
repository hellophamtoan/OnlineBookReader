// services/cartservice.ts
// UC004 - giỏ hàng: K01 (xem), K02 (thêm), K03 (sửa số lượng), K04 (xóa dòng), K05 (làm rỗng).
// Mọi API đều trả về TOÀN BỘ giỏ sau thao tác -> CartContext chỉ việc thay state bằng kết quả.
import type { Cart } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapCart } from './mappers';

export const cartService = {
  // [Gọi API] GET /cart – trang Giỏ hàng, số lượng trên header.
  async getCart(): Promise<Cart> {
    return mapCart((await api.get(ENDPOINTS.cart.root)).data);
  },

  // [Gọi API] POST /cart – nút Thêm vào giỏ.
  // Sách đã có trong giỏ thì cộng dồn số lượng; tổng không được vượt tồn kho (400 OUT_OF_STOCK)
  async addItem(bookId: number, quantity: number): Promise<Cart> {
    return mapCart((await api.post(ENDPOINTS.cart.root, { bookId, quantity })).data);
  },

  // [Gọi API] PUT /cart/:bookId – đổi số lượng trong giỏ.
  // Đặt số lượng mới (không cộng dồn)
  async updateItem(bookId: number, quantity: number): Promise<Cart> {
    return mapCart((await api.put(ENDPOINTS.cart.item(bookId), { quantity })).data);
  },

  // [Gọi API] DELETE /cart/:bookId – xóa một sách khỏi giỏ.
  async removeItem(bookId: number): Promise<Cart> {
    return mapCart((await api.delete(ENDPOINTS.cart.item(bookId))).data);
  },

  // [Gọi API] DELETE /cart – xóa cả giỏ.
  async clear(): Promise<Cart> {
    return mapCart((await api.delete(ENDPOINTS.cart.root)).data);
  },
};
