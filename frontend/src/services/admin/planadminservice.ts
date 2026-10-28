// UC008 admin plans + UC013 topup
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';

export interface AdminPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  status: 'active' | 'inactive';
  isFree?: boolean;
}

export interface AdminUserOption {
  id: number;
  fullName: string;
  email?: string;
  phone?: string | null;
  role: string;
  walletBalance?: number;
}

export const planAdminService = {
  async list(): Promise<AdminPlan[]> {
    const data = (await api.get(ENDPOINTS.admin.plans.root)).data as { items?: AdminPlan[] };
    return Array.isArray(data?.items) ? data.items : [];
  },

  async get(id: number): Promise<AdminPlan> {
    return (await api.get(ENDPOINTS.admin.plans.detail(id))).data as AdminPlan;
  },

  async create(p: {
    name: string;
    description: string;
    price: number;
    durationDays: number;
  }): Promise<AdminPlan> {
    return (await api.post(ENDPOINTS.admin.plans.root, p)).data as AdminPlan;
  },

  async update(
    id: number,
    p: Partial<{ name: string; description: string; price: number; durationDays: number; status: string }>,
  ): Promise<AdminPlan> {
    return (await api.put(ENDPOINTS.admin.plans.detail(id), p)).data as AdminPlan;
  },

  async remove(id: number): Promise<AdminPlan> {
    return (await api.delete(ENDPOINTS.admin.plans.detail(id))).data as AdminPlan;
  },

  /** Danh sách user để nạp ví (mock / học tập) */
  async listUsers(): Promise<AdminUserOption[]> {
    const data = (await api.get(ENDPOINTS.admin.users)).data as { items?: AdminUserOption[] };
    return Array.isArray(data?.items) ? data.items : [];
  },

  /** UC013 — nạp ví (môi trường học tập) */
  async topupWallet(userId: number, amount: number, note?: string) {
    return (
      await api.post(ENDPOINTS.admin.walletTopup(userId), { amount, note: note || undefined })
    ).data as { userId: number; amount: number; balance: number; note: string | null };
  },
};
