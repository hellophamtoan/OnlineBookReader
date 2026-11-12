// UC005 — gói đọc user
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import type { PlanKind } from '../utils/planDates';

export interface ReadingPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  isFree?: boolean;
  planKind: PlanKind;
  basePrice30: number;
}

export interface MySubscriptionInfo {
  hasActiveSubscription: boolean;
  hasLifetime?: boolean;
  currentEndDate: string | null;
  walletBalance?: number;
  freePlanUsed?: boolean;
}

export interface SubscribeResult {
  subscription: {
    id: number;
    planName: string;
    pricePaid: number;
    startDate: string;
    endDate: string;
    planKind?: PlanKind;
    isLifetime?: boolean;
  };
  currentEndDate: string;
  walletBalance: number;
}

export const planService = {
  // [Gọi API] GET /plans – danh sách gói ở trang Gói đọc.
  async list(): Promise<ReadingPlan[]> {
    const data = (await api.get(ENDPOINTS.plans.root)).data as { items?: ReadingPlan[] };
    return Array.isArray(data?.items)
      ? data.items.map((p) => ({
          ...p,
          planKind: p.planKind ?? 'fixed',
          basePrice30: p.basePrice30 ?? p.price,
        }))
      : [];
  },

  // [Gọi API] GET /subscriptions/me – gói đang dùng và ngày hết hạn.
  async me(): Promise<MySubscriptionInfo> {
    const data = (await api.get(ENDPOINTS.plans.me)).data as MySubscriptionInfo;
    return {
      hasActiveSubscription: !!data?.hasActiveSubscription,
      hasLifetime: !!data?.hasLifetime,
      currentEndDate: data?.currentEndDate ?? null,
      walletBalance: data?.walletBalance,
      freePlanUsed: !!data?.freePlanUsed,
    };
  },

  // [Gọi API] POST /subscriptions – mua gói bằng ví (kèm khóa chống gửi trùng).
  async subscribe(planId: number, endDate?: string): Promise<SubscribeResult> {
    return (
      await api.post(ENDPOINTS.plans.subscribe, {
        planId,
        ...(endDate ? { endDate } : {}),
      })
    ).data as SubscribeResult;
  },
};
