// Mock gói đọc + đăng ký (UC005 / UC008)
import { flag } from './http';
import { readJson, writeJson } from './storage';
import type { PlanKind } from '../../utils/planDates';
import { LIFETIME_DAYS } from '../../utils/planDates';

export interface MockPlan {
  id: number;
  name: string;
  description: string;
  /** Giá niêm yết (cố định / trọn đời). Gói tùy chọn: 0 — tính khi user chọn ngày */
  price: number;
  durationDays: number;
  status: 'active' | 'inactive';
  isFree?: boolean;
  /** fixed | lifetime | custom */
  planKind: PlanKind;
  /** Giá cơ sở 30 ngày (gói tùy chọn + tham chiếu) */
  basePrice30: number;
}

export interface MockSubscription {
  id: number;
  userId: number;
  planId: number;
  planName: string;
  pricePaid: number;
  startDate: string;
  endDate: string;
  planKind?: PlanKind;
  isLifetime?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const PLANS_KEY = 'mock_reading_plans_v2';
const SUBS_KEY = 'mock_subscriptions';
const FREE_CLAIM_KEY = 'mock_free_plan_claims';

const seedPlans = (): MockPlan[] => [
  {
    id: 1,
    name: 'Gói đọc 1 tháng',
    description: 'Đọc không giới hạn e-book trong 30 ngày',
    price: 60000,
    durationDays: 30,
    status: 'active',
    planKind: 'fixed',
    basePrice30: 60000,
  },
  {
    id: 2,
    name: 'Gói đọc 3 tháng',
    description: 'Tiết kiệm hơn khi đăng ký 90 ngày',
    price: 129000,
    durationDays: 90,
    status: 'active',
    planKind: 'fixed',
    basePrice30: 60000,
  },
  {
    id: 3,
    name: 'Gói trải nghiệm miễn phí',
    description: 'Dùng thử 30 ngày — mỗi tài khoản chỉ một lần',
    price: 0,
    durationDays: 30,
    status: 'active',
    isFree: true,
    planKind: 'fixed',
    basePrice30: 0,
  },
  {
    id: 4,
    name: 'Gói trọn đời',
    description: 'Đọc không giới hạn vĩnh viễn — không đăng ký thêm gói khác',
    price: 990000,
    durationDays: LIFETIME_DAYS,
    status: 'active',
    planKind: 'lifetime',
    basePrice30: 60000,
  },
  {
    id: 5,
    name: 'Gói tùy chọn',
    description: 'Bạn chọn ngày kết thúc (≥ 30 ngày). Giá tính theo đơn giá 30 ngày.',
    price: 0,
    durationDays: 30,
    status: 'active',
    planKind: 'custom',
    basePrice30: 60000,
  },
];

const seedSubs = (): MockSubscription[] => {
  const now = Date.now();
  return [
    {
      id: 1,
      userId: 2,
      planId: 1,
      planName: 'Gói đọc 1 tháng',
      pricePaid: 60000,
      startDate: new Date(now - 5 * DAY).toISOString(),
      endDate: new Date(now + 25 * DAY).toISOString(),
      planKind: 'fixed',
    },
  ];
};

export const allPlans = () => readJson<MockPlan[]>(PLANS_KEY, seedPlans());
export const savePlans = (list: MockPlan[]) => writeJson(PLANS_KEY, list);
export const publicPlans = () => allPlans().filter((p) => p.status === 'active');
export const allSubscriptions = () => readJson<MockSubscription[]>(SUBS_KEY, seedSubs());
export const saveSubscriptions = (list: MockSubscription[]) => writeJson(SUBS_KEY, list);
export const subscriptionsOf = (userId: number) => allSubscriptions().filter((s) => s.userId === userId);

export const hasActiveSubscription = (userId: number): boolean => {
  if (flag('mock_sub_expired')) return false;
  const now = Date.now();
  return subscriptionsOf(userId).some((s) => Date.parse(s.startDate) <= now && now < Date.parse(s.endDate));
};

/** Đang có gói trọn đời còn hiệu lực → không được mua gói khác */
export const hasLifetimeSubscription = (userId: number): boolean => {
  if (flag('mock_sub_expired')) return false;
  const now = Date.now();
  return subscriptionsOf(userId).some(
    (s) =>
      (s.isLifetime || s.planKind === 'lifetime') &&
      Date.parse(s.startDate) <= now &&
      now < Date.parse(s.endDate),
  );
};

export const currentEndDate = (userId: number): string | null => {
  if (flag('mock_sub_expired')) return null;
  const now = Date.now();
  const ends = subscriptionsOf(userId)
    .filter((s) => Date.parse(s.startDate) <= now && now < Date.parse(s.endDate))
    .map((s) => Date.parse(s.endDate));
  if (!ends.length) return null;
  return new Date(Math.max(...ends)).toISOString();
};

export const previewEndDate = (userId: number, durationDays: number): string => {
  const now = Date.now();
  const cur = currentEndDate(userId);
  const base = cur ? Math.max(now, Date.parse(cur)) : now;
  return new Date(base + durationDays * DAY).toISOString();
};

export const freeClaimed = (userId: number) => readJson<number[]>(FREE_CLAIM_KEY, []).includes(userId);
export const markFreeClaimed = (userId: number) => {
  const ids = readJson<number[]>(FREE_CLAIM_KEY, []);
  if (!ids.includes(userId)) writeJson(FREE_CLAIM_KEY, [...ids, userId]);
};
export const nextPlanId = () => Math.max(0, ...allPlans().map((p) => p.id)) + 1;
export const nextSubId = () => Math.max(0, ...allSubscriptions().map((s) => s.id)) + 1;
