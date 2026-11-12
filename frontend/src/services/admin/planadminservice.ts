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
  // [Gọi API] GET /admin/plans – danh sách gói Admin.
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

  // [Gọi API] GET /admin/plans/:id – lấy gói để sửa.
  async get(id: number): Promise<AdminPlan> {
    const p = (await api.get(ENDPOINTS.admin.plans.detail(id))).data as AdminPlan;
    return { ...p, planKind: p.planKind ?? 'fixed', basePrice30: p.basePrice30 ?? p.price };
  },

  // [Gọi API] POST /admin/plans – thêm gói đọc.
  async create(p: AdminPlanPayload): Promise<AdminPlan> {
    return (await api.post(ENDPOINTS.admin.plans.root, p)).data as AdminPlan;
  },

  // [Gọi API] PUT /admin/plans/:id – sửa gói đọc.
  async update(
    id: number,
    p: Partial<AdminPlanPayload & { status: string }>,
  ): Promise<AdminPlan> {
    return (await api.put(ENDPOINTS.admin.plans.detail(id), p)).data as AdminPlan;
  },

  // [Gọi API] DELETE /admin/plans/:id – ngừng bán gói.
  async remove(id: number): Promise<AdminPlan> {
    return (await api.delete(ENDPOINTS.admin.plans.detail(id))).data as AdminPlan;
  },

  // [Gọi API] GET /admin/users – chọn người dùng để nạp ví.
  async listUsers(): Promise<AdminUserOption[]> {
    // BE paging: limit tối đa 100 — lấy nhiều trang nếu cần
    const pageSize = 100;
    const all: AdminUserOption[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = (await api.get(ENDPOINTS.admin.users, {
        role: 'USER',
        limit: pageSize,
        page,
      })).data as {
        items?: AdminUserOption[];
        totalPages?: number;
        page?: number;
      } | AdminUserOption[];
      if (Array.isArray(data)) {
        all.push(...data);
        break;
      }
      const items = data?.items ?? [];
      all.push(...items);
      totalPages = Number(data?.totalPages) || 1;
      page += 1;
    } while (page <= totalPages && page <= 20);
    return all
      .filter((u) => (u as { role?: string }).role !== 'ADMIN')
      .map((u) => ({
        id: Number(u.id),
        fullName: String(u.fullName ?? (u as { full_name?: string }).full_name ?? ''),
        email: u.email,
        phone: u.phone ?? null,
        role: String(u.role ?? 'USER'),
        walletBalance:
          u.walletBalance != null
            ? Number(u.walletBalance)
            : Number((u as { wallet_balance?: number }).wallet_balance ?? 0),
      }));
  },

  // [Gọi API] POST /admin/users/:id/wallet/topup – nạp ví thủ công.
  async topupWallet(userId: number, amount: number, note?: string) {
    return (
      await api.post(ENDPOINTS.admin.walletTopup(userId), { amount, note: note || undefined })
    ).data as { userId: number; amount: number; balance: number; note: string | null };
  },

  // [Gọi API] GET /admin/users/:id/wallet/topups – lịch sử yêu cầu nạp của người dùng.
  async getUserTopupHistory(userId: number): Promise<UserTopupHistory> {
    return (await api.get(ENDPOINTS.admin.userWalletTopups(userId))).data as UserTopupHistory;
  },

  // [Gọi API] GET /admin/store/bank-account – tài khoản nhận tiền.
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

  // [Gọi API] PUT /admin/store/bank-account – lưu tài khoản nhận tiền.
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

  // [Gọi API] POST /admin/users/:id/wallet/topups/:mã/confirm – xác nhận đã nhận tiền.
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
