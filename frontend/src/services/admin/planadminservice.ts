// UC008 admin plans + UC013 topup + TK nhận tiền + lịch sử nạp
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

export interface WalletTopupTx {
  id: number;
  type: string;
  amount: number;
  balanceAfter?: number | null;
  note?: string | null;
  externalReference?: string | null;
  createdAt: string;
}

export interface WalletTopupRequestRow {
  id: number;
  amount: number;
  gateway: string;
  status: string;
  orderCode: string;
  gatewayTxnId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  note?: string | null;
}

export interface UserTopupHistory {
  user: { id: number; fullName: string; email: string; walletBalance: number };
  transactions: WalletTopupTx[];
  requests: WalletTopupRequestRow[];
}

export interface StoreBankAccount {
  bin: string;
  accountNo: string;
  accountName: string;
  bankName: string;
  source?: string;
}

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

  async remove(id: number): Promise<AdminPlan> {
    return (await api.delete(ENDPOINTS.admin.plans.detail(id))).data as AdminPlan;
  },

  async listUsers(): Promise<AdminUserOption[]> {
    const data = (await api.get(ENDPOINTS.admin.users, { role: 'USER', limit: 500 })).data as {
      items?: AdminUserOption[];
    } | AdminUserOption[];
    const items = Array.isArray(data) ? data : data?.items ?? [];
    return items.filter((u) => (u as { role?: string }).role !== 'ADMIN');
  },

  async topupWallet(userId: number, amount: number, note?: string) {
    return (
      await api.post(ENDPOINTS.admin.walletTopup(userId), { amount, note: note || undefined })
    ).data as { userId: number; amount: number; balance: number; note: string | null };
  },

  async getUserTopupHistory(userId: number): Promise<UserTopupHistory> {
    return (await api.get(ENDPOINTS.admin.userWalletTopups(userId))).data as UserTopupHistory;
  },

  async getStoreBankAccount(): Promise<{
    configured: boolean;
    bank: StoreBankAccount | null;
    hint?: string;
  }> {
    return (await api.get(ENDPOINTS.admin.storeBankAccount)).data as {
      configured: boolean;
      bank: StoreBankAccount | null;
      hint?: string;
    };
  },

  async updateStoreBankAccount(body: {
    bin: string;
    accountNo: string;
    accountName: string;
    bankName?: string;
  }): Promise<{ bank: StoreBankAccount; configured: boolean }> {
    return (await api.put(ENDPOINTS.admin.storeBankAccount, body)).data as {
      bank: StoreBankAccount;
      configured: boolean;
    };
  },

  /** Admin xác nhận đã nhận CK → cộng ví, PENDING → PAID */
  async confirmUserTopup(userId: number, orderCode: string) {
    return (
      await api.post(ENDPOINTS.admin.confirmUserTopup(userId, orderCode), {})
    ).data as {
      userId: number;
      orderCode: string;
      amount: number;
      balance: number;
      status: string;
      paidAt: string;
    };
  },
};
