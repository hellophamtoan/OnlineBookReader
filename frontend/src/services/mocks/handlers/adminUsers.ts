// UC010 — Admin quản lý người dùng (API-65..68) + mở rộng list UC013
import { MockHttpError, toInt } from '../http';
import type { Route } from '../router';
import { allUsers, findUserById, setUserActive } from '../db';
import { getWallet, allOrders } from '../shopdb';
import { hasActiveSubscription, hasLifetimeSubscription, currentEndDate } from '../subscriptiondb';
import { paginate } from './common';
import { requireAdmin } from './guards';

const validation = (message: string, field?: string) =>
  new MockHttpError(400, message, 'VALIDATION_ERROR', field ? [{ field, message }] : undefined);

function publicAdminUser(u: ReturnType<typeof allUsers>[0]) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role,
    isActive: u.isActive,
    walletBalance: getWallet(u),
    hasActiveSubscription: u.role === 'USER' ? hasActiveSubscription(u.id) : false,
    createdAt: undefined as string | undefined,
  };
}

export const adminUserRoutes: Route[] = [
  {
    method: 'GET',
    path: '/admin/users',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const page = Math.max(1, toInt(query.get('page')) || 1);
      const limit = Math.min(100, Math.max(1, toInt(query.get('limit')) || 20));
      const role = query.get('role') || '';
      const isActiveRaw = query.get('isActive');
      const q = (query.get('q') || '').trim().toLowerCase();

      let list = allUsers();
      if (role === 'USER' || role === 'ADMIN') list = list.filter((u) => u.role === role);
      if (isActiveRaw === 'true') list = list.filter((u) => u.isActive);
      if (isActiveRaw === 'false') list = list.filter((u) => !u.isActive);
      if (q) {
        list = list.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.phone ?? '').includes(q) ||
            String(u.id) === q,
        );
      }
      list = [...list].sort((a, b) => a.id - b.id);
      const pageData = paginate(list, page, limit);
      return {
        message: 'Lấy danh sách người dùng thành công',
        data: {
          items: pageData.items.map(publicAdminUser),
          page,
          limit,
          total: pageData.total,
          totalPages: pageData.totalPages,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/admin/users/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const u = findUserById(id);
      if (!u) throw new MockHttpError(404, 'Không tìm thấy người dùng', 'NOT_FOUND');
      const orders = allOrders().filter((o) => o.userId === id);
      const totalSpent = orders
        .filter((o) => o.status === 'DELIVERED')
        .reduce((s, o) => s + o.totalAmount, 0);
      return {
        message: 'OK',
        data: {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone ?? null,
          role: u.role,
          isActive: u.isActive,
          walletBalance: getWallet(u),
          address: u.address ?? null,
          subscription:
            u.role === 'USER'
              ? {
                  hasActiveSubscription: hasActiveSubscription(u.id),
                  isLifetime: hasLifetimeSubscription(u.id),
                  currentEndDate: currentEndDate(u.id),
                }
              : null,
          orderStats: { totalOrders: orders.length, totalSpent },
        },
      };
    },
  },
  {
    method: 'PATCH',
    path: '/admin/users/:id/lock',
    handler: ({ token, params }) => {
      const admin = requireAdmin(token);
      const id = toInt(params.id);
      const u = findUserById(id);
      if (!u) throw new MockHttpError(404, 'Không tìm thấy người dùng', 'NOT_FOUND');
      if (u.id === admin.id) throw validation('Không thể khóa chính tài khoản đang đăng nhập');
      if (u.role === 'ADMIN') throw validation('Không khóa tài khoản quản trị qua API này');
      setUserActive(id, false);
      return { message: 'Đã khóa tài khoản', data: { id, isActive: false } };
    },
  },
  {
    method: 'PATCH',
    path: '/admin/users/:id/unlock',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const u = findUserById(id);
      if (!u) throw new MockHttpError(404, 'Không tìm thấy người dùng', 'NOT_FOUND');
      setUserActive(id, true);
      return { message: 'Đã mở khóa tài khoản', data: { id, isActive: true } };
    },
  },
];
