// UC005 API-50..52 + UC008 API-53..57 + UC013 API-58 (mock)
import { MockHttpError, toInt } from '../http';
import type { Route } from '../router';
import {
  allPlans,
  currentEndDate,
  freeClaimed,
  hasActiveSubscription,
  markFreeClaimed,
  nextPlanId,
  nextSubId,
  previewEndDate,
  publicPlans,
  savePlans,
  saveSubscriptions,
  allSubscriptions,
} from '../subscriptiondb';
import { addWalletTx, getWallet, setWallet } from '../shopdb';
import { requireAdmin, requireCustomer } from './guards';
import { allUsers, findUserById } from '../db';

const validation = (message: string, field?: string) =>
  new MockHttpError(400, message, 'VALIDATION_ERROR', field ? [{ field, message }] : undefined);

export const planRoutes: Route[] = [
  // API-50 public
  {
    method: 'GET',
    path: '/plans',
    handler: () => ({
      message: 'Lấy danh sách gói đọc thành công',
      data: {
        items: publicPlans().map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          durationDays: p.durationDays,
          isFree: !!p.isFree,
        })),
      },
    }),
  },

  // API-52
  {
    method: 'GET',
    path: '/subscriptions/me',
    handler: ({ token }) => {
      const user = requireCustomer(token);
      const end = currentEndDate(user.id);
      return {
        message: 'Lấy thông tin gói đọc thành công',
        data: {
          hasActiveSubscription: hasActiveSubscription(user.id),
          currentEndDate: end,
          walletBalance: getWallet(user),
          freePlanUsed: freeClaimed(user.id),
        },
      };
    },
  },

  // API-51
  {
    method: 'POST',
    path: '/subscriptions',
    handler: ({ token, body }) => {
      const user = requireCustomer(token);
      const b = (body ?? {}) as Record<string, unknown>;
      const planId = toInt(b.planId);
      if (!Number.isInteger(planId) || planId < 1) throw validation('Mã gói không hợp lệ', 'planId');
      const plan = allPlans().find((p) => p.id === planId && p.status === 'active');
      if (!plan) throw new MockHttpError(404, 'Không tìm thấy gói đọc', 'PLAN_NOT_FOUND');

      if (plan.isFree || plan.price <= 0) {
        if (freeClaimed(user.id)) {
          throw new MockHttpError(409, 'Bạn đã dùng gói miễn phí rồi (mỗi tài khoản một lần)', 'FREE_PLAN_USED');
        }
      } else if (getWallet(user) < plan.price) {
        throw new MockHttpError(400, 'Số dư ví không đủ để đăng ký gói', 'INSUFFICIENT_BALANCE');
      }

      const now = new Date();
      const endIso = previewEndDate(user.id, plan.durationDays);
      const startIso = now.toISOString();
      const sub = {
        id: nextSubId(),
        userId: user.id,
        planId: plan.id,
        planName: plan.name,
        pricePaid: plan.price,
        startDate: startIso,
        endDate: endIso,
      };
      saveSubscriptions([sub, ...allSubscriptions()]);

      if (plan.isFree || plan.price <= 0) {
        markFreeClaimed(user.id);
      } else {
        setWallet(user.id, getWallet(user) - plan.price);
        addWalletTx({
          userId: user.id,
          type: 'PAY_PLAN',
          amount: -plan.price,
          refType: 'SUBSCRIPTION',
          refId: sub.id,
        });
      }

      return {
        status: 201,
        message: 'Đăng ký gói đọc thành công',
        data: {
          subscription: {
            id: sub.id,
            planName: sub.planName,
            pricePaid: sub.pricePaid,
            startDate: sub.startDate,
            endDate: sub.endDate,
          },
          currentEndDate: endIso,
          walletBalance: getWallet(user),
        },
      };
    },
  },

  // ----- UC008 admin plans -----
  {
    method: 'GET',
    path: '/admin/plans',
    handler: ({ token }) => {
      requireAdmin(token);
      return {
        message: 'Lấy danh sách gói (admin) thành công',
        data: { items: allPlans() },
      };
    },
  },
  {
    method: 'GET',
    path: '/admin/plans/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const plan = allPlans().find((p) => p.id === id);
      if (!plan) throw new MockHttpError(404, 'Không tìm thấy gói', 'NOT_FOUND');
      return { message: 'Lấy chi tiết gói thành công', data: plan };
    },
  },
  {
    method: 'POST',
    path: '/admin/plans',
    handler: ({ token, body }) => {
      requireAdmin(token);
      const b = (body ?? {}) as Record<string, unknown>;
      const name = String(b.name ?? '').trim();
      const description = String(b.description ?? '').trim();
      const price = Number(b.price);
      const durationDays = Number(b.durationDays);
      if (!name) throw validation('Tên gói bắt buộc', 'name');
      if (!Number.isFinite(price) || price < 0) throw validation('Giá không hợp lệ', 'price');
      if (!Number.isInteger(durationDays) || durationDays < 1) throw validation('Số ngày không hợp lệ', 'durationDays');
      const dup = allPlans().some((p) => p.status === 'active' && p.name.trim().toLowerCase() === name.toLowerCase());
      if (dup) throw new MockHttpError(409, 'Đã có gói đang hoạt động trùng tên', 'DUPLICATE_NAME');
      const plan = {
        id: nextPlanId(),
        name,
        description,
        price,
        durationDays,
        status: 'active' as const,
        isFree: price === 0,
      };
      savePlans([plan, ...allPlans()]);
      return { status: 201, message: 'Đã tạo gói đọc', data: plan };
    },
  },
  {
    method: 'PUT',
    path: '/admin/plans/:id',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const list = allPlans();
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) throw new MockHttpError(404, 'Không tìm thấy gói', 'NOT_FOUND');
      const b = (body ?? {}) as Record<string, unknown>;
      const cur = list[idx];
      const name = b.name !== undefined ? String(b.name).trim() : cur.name;
      const description = b.description !== undefined ? String(b.description).trim() : cur.description;
      const price = b.price !== undefined ? Number(b.price) : cur.price;
      const durationDays = b.durationDays !== undefined ? Number(b.durationDays) : cur.durationDays;
      const status = b.status === 'inactive' || b.status === 'active' ? b.status : cur.status;
      if (!name) throw validation('Tên gói bắt buộc', 'name');
      if (!Number.isFinite(price) || price < 0) throw validation('Giá không hợp lệ', 'price');
      if (!Number.isInteger(durationDays) || durationDays < 1) throw validation('Số ngày không hợp lệ', 'durationDays');
      const updated = {
        ...cur,
        name,
        description,
        price,
        durationDays,
        status,
        isFree: price === 0,
      };
      list[idx] = updated;
      savePlans(list);
      return { message: 'Đã cập nhật gói', data: updated };
    },
  },
  {
    method: 'DELETE',
    path: '/admin/plans/:id',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = toInt(params.id);
      const list = allPlans();
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) throw new MockHttpError(404, 'Không tìm thấy gói', 'NOT_FOUND');
      list[idx] = { ...list[idx], status: 'inactive' };
      savePlans(list);
      return { message: 'Đã ngừng bán gói (xóa mềm)', data: list[idx] };
    },
  },

  // UC013 API-58 admin topup
  
  // Danh sách user (học tập — phục vụ form nạp ví)
  {
    method: 'GET',
    path: '/admin/users',
    handler: ({ token }) => {
      requireAdmin(token);
      const items = allUsers()
        .filter((u) => u.isActive)
        .map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone ?? null,
          role: u.role,
          walletBalance: getWallet(u),
        }));
      return { message: 'Lấy danh sách người dùng thành công', data: { items } };
    },
  },
  {
    method: 'POST',
    path: '/admin/users/:id/wallet/topup',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const userId = toInt(params.id);
      if (!Number.isInteger(userId) || userId < 1) throw validation('Mã người dùng không hợp lệ');
      const b = (body ?? {}) as Record<string, unknown>;
      const amount = Number(b.amount);
      const note = String(b.note ?? '').trim();
      if (!Number.isInteger(amount) || amount <= 0) throw validation('Số tiền phải là số nguyên dương', 'amount');
      if (note.length > 255) throw validation('Ghi chú tối đa 255 ký tự', 'note');
      const target = findUserById(userId);
      if (!target) throw new MockHttpError(404, 'Không tìm thấy người dùng', 'NOT_FOUND');

      const before = getWallet(target);
      setWallet(userId, before + amount);
      addWalletTx({
        userId,
        type: 'TOPUP',
        amount,
        refType: 'ADMIN',
        refId: null,
      });
      return {
        message: 'Đã nạp tiền vào ví (môi trường học tập / test)',
        data: {
          userId,
          amount,
          balance: before + amount,
          note: note || null,
        },
      };
    },
  },
];
