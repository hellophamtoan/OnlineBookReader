// UC011 — Báo cáo
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';

export interface ReportOverview {
  from: string;
  to: string;
  revenue: { orderRevenue: number; planRevenue: number; total: number };
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    shipping: number;
    delivered: number;
    cancelled: number;
    failed: number;
  };
  subscriptions: { newCount: number; activeUsers: number; lifetimeCount: number };
  users: { newUsers: number; activeUsers: number };
  metrics?: {
    grossRevenue: number;
    deliveredOrders: number;
    cancelledOrders: number;
    productsSold: number;
    avgOrderValue: number;
    growthPercent: number | null;
    deliveredGrowthPercent?: number | null;
    activeUsers?: number;
    usersOnPlan?: number;
  };
  previousPeriod?: {
    from: string;
    to: string;
    grossRevenue: number;
    deliveredOrders: number;
    cancelledOrders: number;
    productsSold: number;
    avgOrderValue: number;
    activeUsers?: number;
    usersOnPlan?: number;
    orderRevenue?: number;
    planRevenue?: number;
  };
  paymentMethods?: { method: string; orderCount: number; revenue: number }[];
}

export const reportAdminService = {
  async overview(from?: string, to?: string): Promise<ReportOverview> {
    return (await api.get(ENDPOINTS.admin.reports.overview, { from, to })).data as ReportOverview;
  },
  async revenue(from?: string, to?: string, groupBy: 'day' | 'month' = 'day') {
    return (await api.get(ENDPOINTS.admin.reports.revenue, { from, to, groupBy })).data as {
      from: string;
      to: string;
      groupBy: string;
      points: { label: string; orderRevenue: number; planRevenue: number; total: number }[];
    };
  },
  async bestSellers(from?: string, to?: string, limit = 10) {
    return (await api.get(ENDPOINTS.admin.reports.bestSellers, { from, to, limit })).data as {
      items: { bookId: number; title: string; quantitySold: number; revenue: number }[];
    };
  },
  async subscriptions(from?: string, to?: string) {
    return (await api.get(ENDPOINTS.admin.reports.subscriptions, { from, to })).data as {
      from: string;
      to: string;
      byPlan: { planId: number; planName: string; planType: string; count: number; revenue: number }[];
      newSubscriptions: number;
      freeClaims: number;
    };
  },
};
