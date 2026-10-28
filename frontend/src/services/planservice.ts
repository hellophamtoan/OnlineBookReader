// UC005 — gói đọc user
import { api } from './api';
import { ENDPOINTS } from './endpoints';

export interface ReadingPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  isFree?: boolean;
}

export interface MySubscriptionInfo {
  hasActiveSubscription: boolean;
  currentEndDate: string | null;
  walletBalance?: number;
  /** Đã nhận gói miễn phí (mỗi tài khoản một lần) */
  freePlanUsed?: boolean;
}

export interface SubscribeResult {
  subscription: {
    id: number;
    planName: string;
    pricePaid: number;
    startDate: string;
    endDate: string;
  };
  currentEndDate: string;
  walletBalance: number;
}

export const planService = {
  async list(): Promise<ReadingPlan[]> {
    const data = (await api.get(ENDPOINTS.plans.root)).data as { items?: ReadingPlan[] };
    return Array.isArray(data?.items) ? data.items : [];
  },

  async me(): Promise<MySubscriptionInfo> {
    const data = (await api.get(ENDPOINTS.plans.me)).data as MySubscriptionInfo;
    return {
      hasActiveSubscription: !!data?.hasActiveSubscription,
      currentEndDate: data?.currentEndDate ?? null,
      walletBalance: data?.walletBalance,
      freePlanUsed: !!data?.freePlanUsed,
    };
  },

  async subscribe(planId: number): Promise<SubscribeResult> {
    return (await api.post(ENDPOINTS.plans.subscribe, { planId })).data as SubscribeResult;
  },
};
