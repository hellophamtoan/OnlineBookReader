import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cartService } from '../services/cartservice';
import type { Cart } from '../types';
import { EMPTY_CART, cartCount } from '../utils/order';
import { useAuth } from './AuthContext';

interface CartContextValue {
  cart: Cart;
  count: number; // tổng số cuốn, hiện ở huy hiệu trên Header
  loading: boolean; // đang tải giỏ lần đầu sau khi đăng nhập
  // Các thao tác gọi API rồi thay state bằng giỏ mới mà API trả về. Lỗi được ném ra để nơi gọi hiển thị.
  refresh: () => Promise<void>;
  addItem: (bookId: number, quantity: number) => Promise<void>;
  updateItem: (bookId: number, quantity: number) => Promise<void>;
  removeItem: (bookId: number) => Promise<void>;
  clear: () => Promise<void>;
  // Đặt hàng thành công: BE đã xóa giỏ, FE chỉ cần làm rỗng state (không gọi API)
  reset: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Giỏ hàng chỉ dành cho USER (ADMIN gọi sẽ 403) nên chỉ tải khi vai trò là USER.
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isCustomer = user?.role === 'USER';
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setCart(await cartService.getCart());
  }, []);

  // Đăng nhập -> tải giỏ; đăng xuất / đổi sang ADMIN -> xóa state để không lộ giỏ của người trước
  useEffect(() => {
    if (!isCustomer) {
      setCart(EMPTY_CART);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    cartService
      .getCart()
      .then((c) => !cancelled && setCart(c))
      .catch(() => {}) // lỗi mạng: giữ giỏ rỗng, trang giỏ hàng có nút thử lại
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isCustomer, user?.id]);

  const addItem = useCallback(async (bookId: number, quantity: number) => setCart(await cartService.addItem(bookId, quantity)), []);
  const updateItem = useCallback(async (bookId: number, quantity: number) => setCart(await cartService.updateItem(bookId, quantity)), []);
  const removeItem = useCallback(async (bookId: number) => setCart(await cartService.removeItem(bookId)), []);
  const clear = useCallback(async () => setCart(await cartService.clear()), []);
  const reset = useCallback(() => setCart(EMPTY_CART), []);

  const value = useMemo(
    () => ({ cart, count: cartCount(cart), loading, refresh, addItem, updateItem, removeItem, clear, reset }),
    [cart, loading, refresh, addItem, updateItem, removeItem, clear, reset]
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart phải được dùng bên trong <CartProvider>');
  return ctx;
}
