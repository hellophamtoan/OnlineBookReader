// UC010 — Admin người dùng (API-65..68). BE hiện có GET /admin/users (chỉ USER active) — FE mock đủ UC010.
import { api } from '../api';
import { ENDPOINTS } from '../endpoints';

export interface AdminUserListItem {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  walletBalance: number;
  hasActiveSubscription?: boolean;
  createdAt?: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  address?: string | null;
  subscription: {
    hasActiveSubscription: boolean;
    isLifetime: boolean;
    currentEndDate: string | null;
  } | null;
  orderStats: { totalOrders: number; totalSpent: number };
}

export interface AdminUserListResult {
  items: AdminUserListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// [Xử lý] Chuẩn hóa danh sách người dùng.
function normalizeList(raw: unknown): AdminUserListResult {
  const d = (raw ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? d.items : Array.isArray(raw) ? raw : []) as AdminUserListItem[];
  // BE listUsers chỉ trả USER active, có thể không có page/total
  const mapped = items.map((u) => ({
    ...u,
    isActive: u.isActive !== false,
    phone: u.phone ?? null,
    walletBalance: Number(u.walletBalance ?? 0),
  }));
  const page = Number(d.page ?? 1) || 1;
  const limit = Number((d.limit ?? mapped.length) || 20) || 20;
  const total = Number(d.total ?? mapped.length) || mapped.length;
  const totalPages = Number(d.totalPages ?? Math.max(1, Math.ceil(total / limit))) || 1;
  return { items: mapped, page, limit, total, totalPages };
}

export const userAdminService = {
  // [Gọi API] GET /admin/users – bảng người dùng.
  async list(q: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: string;
    q?: string;
  } = {}): Promise<AdminUserListResult> {
    const data = (await api.get(ENDPOINTS.admin.users, q as Record<string, string | number | undefined>)).data;
    return normalizeList(data);
  },
  // [Gọi API] GET /admin/users/:id – chi tiết người dùng.
  async get(id: number): Promise<AdminUserDetail> {
    return (await api.get(ENDPOINTS.admin.userDetail(id))).data as AdminUserDetail;
  },
  // [Gọi API] PATCH /admin/users/:id/lock – khóa tài khoản.
  async lock(id: number, reason?: string) {
    return (await api.patch(ENDPOINTS.admin.userLock(id), { reason })).data as { id: number; isActive: boolean };
  },
  // [Gọi API] PATCH /admin/users/:id/unlock – mở khóa tài khoản.
  async unlock(id: number) {
    return (await api.patch(ENDPOINTS.admin.userUnlock(id), {})).data as { id: number; isActive: boolean };
  },
};