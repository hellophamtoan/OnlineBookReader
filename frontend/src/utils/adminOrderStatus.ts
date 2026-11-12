// Chuẩn hóa trạng thái đơn UC009:
// - Backend & FE dùng: PENDING | PREPARING | SHIPPING | DELIVERED | FAILED | CANCELLED
// - Hợp đồng UC009 ghi CONFIRMED (= PREPARING trên BE)
import type { OrderStatus } from '../types';

const ALLOWED: OrderStatus[] = [
  'PENDING',
  'PREPARING',
  'SHIPPING',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
];

// [Xử lý] Chuẩn hóa tên trạng thái đơn (PREPARING → CONFIRMED...).
/** Map body hợp đồng (CONFIRMED) → enum BE/FE (PREPARING) */
export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  if (s === 'CONFIRMED') return 'PREPARING';
  if (ALLOWED.includes(s as OrderStatus)) return s as OrderStatus;
  return null;
}

/** Trạng thái kế tiếp hợp lệ (khớp logic BE order + hợp đồng admin) */
export const ADMIN_ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PREPARING', 'CANCELLED', 'FAILED'],
  // Khớp backend: giao thất bại chỉ xảy ra khi đơn đang giao (SHIPPING)
  PREPARING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  CANCELLED: [],
  FAILED: [],
};
