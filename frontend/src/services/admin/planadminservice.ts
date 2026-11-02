// UC008 admin plans + UC013 topup
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';
import type { PlanKind } from '../../utils/planDates';

export interface AdminPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  status: 'active' | 'inactive';
  isFree?: boolean;
  planKind: PlanKind;
  basePrice30: number;
}

export interface AdminUserOption {
  id: number;
  fullName: string;
  email?: string;
  phone?: string | null;
  role: string;
  walletBalance?: number;
}

export type AdminPlanPayload = {
  name: string;
  description: string;
  planKind: PlanKind;
  basePrice30: number;
  price: number;
  durationDays: number;
};

export const planAdminService = {
  async list(): Promise<AdminPlan[]> {
    const data = (await api.get(ENDPOINTS.admin.plans.root)).data as { items?: AdminPlan[] };
    return Array.isArray(data?.items)
      ? data.items.map((p) => ({
          ...p,
          planKind: p.planKind ?? 'fixed',
          basePrice30: p.basePrice30 ?? p.price,
        }))
      : [];
  },

  async get(id: number): Promise<AdminPlan> {
    const p = (await api.get(ENDPOINTS.admin.plans.detail(id))).data as AdminPlan;
    return { ...p, planKind: p.planKind ?? 'fixed', basePrice30: p.basePrice30 ?? p.price };
  },

  async create(p: AdminPlanPayload): Promise<AdminPlan> {
    return (await api.post(ENDPOINTS.admin.plans.root, p)).data as AdminPlan;
  },

  async update(
    id: number,
    p: Partial<AdminPlanPayload & { status: string }>,
  ): Promise<AdminPlan> {
    return (await api.put(ENDPOINTS.admin.plans.detail(id), p)).data as AdminPlan;
  },

  async remove(id: number): Promise<void> {
    await api.delete(ENDPOINTS.admin.plans.detail(id));
  },

  async listUsers(): Promise<AdminUserOption[]> {
    const data = (await api.get(ENDPOINTS.admin.users)).data as { items?: AdminUserOption[] };
    return Array.isArray(data?.items) ? data.items : [];
  },

  async topupWallet(userId: number, amount: number, note?: string) {
    return (
      await api.post(ENDPOINTS.admin.walletTopup(userId), { amount, note: note || undefined })
    ).data as { userId: number; amount: number; balance: number; note: string | null };
  },
};
