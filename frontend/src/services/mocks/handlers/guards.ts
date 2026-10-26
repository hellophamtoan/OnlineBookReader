// services/mocks/handlers/guards.ts
// Kiểm tra quyền dùng chung cho các handler. Khớp mục "Phân quyền" của hợp đồng:
//  - requireCustomer: API chỉ dành cho USER (giỏ hàng, đơn hàng, ví...) mà ADMIN gọi -> 403 FORBIDDEN.
//  - requireReader:   USER + gói đọc còn hiệu lực, không thì 403 SUBSCRIPTION_REQUIRED (UC006).
//  - requireReaderOrFreePreview: USER; chương trong giới hạn miễn phí (10 chương đầu) không cần gói.
//  - requireAdmin:    nhóm /admin/* chỉ ADMIN, USER gọi -> 403 FORBIDDEN (UC007).
import type { MockUser } from '../db';
import { MockHttpError } from '../http';
import { hasActiveSubscription } from '../subscriptiondb';
import { requireUser } from './auth';

/** Số chương đầu mỗi sách được đọc miễn phí khi chưa có gói (quy ước: 10 "trang"/chương đầu). */
export const FREE_CHAPTER_LIMIT = 10;

const forbidden = () => new MockHttpError(403, 'Bạn không có quyền thực hiện thao tác này', 'FORBIDDEN');

export const requireCustomer = (token: string | null): MockUser => {
  const user = requireUser(token);
  if (user.role !== 'USER') throw forbidden();
  return user;
};

export const requireReader = (token: string | null): MockUser => {
  const user = requireCustomer(token);
  if (!hasActiveSubscription(user.id)) {
    throw new MockHttpError(403, 'Bạn cần có gói đọc còn hiệu lực để đọc sách trực tuyến', 'SUBSCRIPTION_REQUIRED');
  }
  return user;
};

/**
 * Cho phép USER đọc nếu có gói hợp lệ HOẶC chapterNumber nằm trong FREE_CHAPTER_LIMIT.
 * Mục lục / progress: luôn cho USER (để hiện TOC + tiến độ); chặn nội dung ở API-11.
 */
export const requireReaderOrFreePreview = (token: string | null, chapterNumber?: number): MockUser => {
  const user = requireCustomer(token);
  if (hasActiveSubscription(user.id)) return user;
  if (chapterNumber !== undefined && chapterNumber >= 1 && chapterNumber <= FREE_CHAPTER_LIMIT) return user;
  throw new MockHttpError(
    403,
    `Bạn đã hết nội dung miễn phí (${FREE_CHAPTER_LIMIT} chương đầu). Vui lòng đăng ký gói đọc để tiếp tục.`,
    'SUBSCRIPTION_REQUIRED',
  );
};

export const requireAdmin = (token: string | null): MockUser => {
  const user = requireUser(token);
  if (user.role !== 'ADMIN') throw forbidden();
  return user;
};
