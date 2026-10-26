// services/mocks/subscriptiondb.ts
// "CSDL" giả cho GÓI ĐỌC của người dùng. UC006 chỉ cần biết "còn hiệu lực hay không" (start_date <= now <= end_date).
// UC005 (đăng ký gói) sẽ GHI thêm vào đây bằng writeJson(KEY, ...) khi làm; UC008 (quản lý gói) không cần động vào file này.
//
// Dữ liệu mẫu: user1@bookstore.local (id 2) có gói còn 25 ngày; các tài khoản khác (kể cả tài khoản mới đăng ký) chưa có gói -> 403.
// Thử "gói hết hạn": trong Console chạy  localStorage.setItem('mock_sub_expired','1')  (xóa khóa này để trở lại bình thường).
import { flag } from './http';
import { readJson } from './storage';

export interface MockSubscription {
  id: number;
  userId: number;
  planName: string;
  startDate: string; // ISO
  endDate: string; // ISO
}

const DAY = 24 * 60 * 60 * 1000;
const KEY = 'mock_subscriptions';

const seed = (): MockSubscription[] => {
  const now = Date.now();
  return [{ id: 1, userId: 2, planName: 'Gói đọc 1 tháng', startDate: new Date(now - 5 * DAY).toISOString(), endDate: new Date(now + 25 * DAY).toISOString() }];
};

export const subscriptionsOf = (userId: number): MockSubscription[] => readJson<MockSubscription[]>(KEY, seed()).filter((s) => s.userId === userId);

export const hasActiveSubscription = (userId: number): boolean => {
  if (flag('mock_sub_expired')) return false;
  const now = Date.now();
  return subscriptionsOf(userId).some((s) => Date.parse(s.startDate) <= now && now <= Date.parse(s.endDate));
};
