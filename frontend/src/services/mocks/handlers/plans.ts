// UC005 API-50..52 + UC008 API-53..57 + UC013 API-58 (mock)
import { MockHttpError, toInt } from '../http';
import type { Route } from '../router';
import {
  allPlans,
  currentEndDate,
  freeClaimed,
  hasActiveSubscription,
  hasLifetimeSubscription,
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
import { allUsers } from '../db';
import {
  LIFETIME_DAYS,
  PLAN_MIN_DAYS,
  normalizePlanKind,
  progressivePlanPrice,
  todayYmd,
  validateEndDate,
  type PlanKind,
} from '../../../utils/planDates';

const validation = (message: string, field?: string) =>
  new MockHttpError(400, message, 'VALIDATION_ERROR', field ? [{ field, message }] : undefined);

const mapPublicPlan = (p: {
  id: number;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  isFree?: boolean;
  planKind?: PlanKind;
  basePrice30?: number;
}) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: p.price,
  durationDays: p.durationDays,
  isFree: !!p.isFree,
  planKind: p.planKind ?? 'fixed',
  basePrice30: p.basePrice30 ?? p.price,
});

export const planRoutes: Route[] = [
  {
    method: 'GET',
    path: '/plans',
    handler: () => ({
      message: 'Lấy danh sách gói đọc thành công',
      data: { items: publicPlans().map(mapPublicPlan) },
    }),
  },

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
          hasLifetime: hasLifetimeSubscription(user.id),
          currentEndDate: end,
          walletBalance: getWallet(user),
          freePlanUsed: freeClaimed(user.id),
        },
      };
    },
  },

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

      if (hasLifetimeSubscription(user.id)) {
        throw new MockHttpError(
          409,
          'Bạn đã có gói trọn đời — không thể đăng ký thêm gói khác',
          'LIFETIME_ACTIVE',
        );
      }

      const kind: PlanKind = plan.planKind ?? 'fixed';
      let pricePaid = plan.price;
      let durationDays = plan.durationDays;
      let isLifetime = kind === 'lifetime';
      let endIso: string;

      if (kind === 'custom') {
        const endYmd = String(b.endDate ?? '').trim();
        const start = todayYmd();
        const check = validateEndDate(start, endYmd);
        if (!check.ok) throw validation(check.message, 'endDate');
        durationDays = check.days;
        pricePaid = progressivePlanPrice(durationDays, plan.basePrice30 || 60000);
        endIso = previewEndDate(user.id, durationDays);
      } else if (kind === 'lifetime') {
        durationDays = LIFETIME_DAYS;
        pricePaid = plan.price;
        endIso = previewEndDate(user.id, durationDays);
        isLifetime = true;
      } else {
        // fixed
        durationDays = plan.durationDays;
        pricePaid = plan.price;
        endIso = previewEndDate(user.id, durationDays);
      }

      if (plan.isFree || pricePaid <= 0) {
        if (freeClaimed(user.id)) {
          throw new MockHttpError(409, 'Bạn đã dùng gói miễn phí rồi (mỗi tài khoản một lần)', 'FREE_PLAN_USED');
        }
      } else if (getWallet(user) < pricePaid) {
        throw new MockHttpError(400, 'Số dư ví không đủ để đăng ký gói', 'INSUFFICIENT_BALANCE');
      }

      const now = new Date();
      const startIso = now.toISOString();
      const sub = {
        id: nextSubId(),
        userId: user.id,
        planId: plan.id,
        planName: plan.name,
        pricePaid,
        startDate: startIso,
        endDate: endIso,
        planKind: kind,
        isLifetime,
      };
      saveSubscriptions([sub, ...allSubscriptions()]);

      if (plan.isFree || pricePaid <= 0) {
        markFreeClaimed(user.id);
      } else {
        setWallet(user.id, getWallet(user) - pricePaid);
        addWalletTx({
          userId: user.id,
          type: 'PAY_PLAN',
          amount: -pricePaid,
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
            planKind: kind,
            isLifetime,
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
        data: {
          items: allPlans().map((p) => ({
            ...p,
            planKind: p.planKind ?? 'fixed',
            basePrice30: p.basePrice30 ?? p.price,
          })),
        },
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
      return {
        message: 'Lấy chi tiết gói thành công',
        data: { ...plan, planKind: plan.planKind ?? 'fixed', basePrice30: plan.basePrice30 ?? plan.price },
      };
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
      const planKind = normalizePlanKind(b.planKind);
      const basePrice30 = Number(b.basePrice30 ?? b.price ?? 0);
      let price = Number(b.price);
      let durationDays = Number(b.durationDays);

      if (!name) throw validation('Tên gói bắt buộc', 'name');
      if (!Number.isFinite(basePrice30) || basePrice30 < 0) {
        throw validation('Giá cơ sở 30 ngày không hợp lệ', 'basePrice30');
      }

      if (planKind === 'custom') {
        durationDays = PLAN_MIN_DAYS;
        price = 0;
      } else if (planKind === 'lifetime') {
        durationDays = LIFETIME_DAYS;
        if (!Number.isFinite(price) || price < 0) throw validation('Giá không hợp lệ', 'price');
      } else {
        if (!Number.isInteger(durationDays) || durationDays < 1) {
          throw validation('Số ngày không hợp lệ', 'durationDays');
        }
        if (!Number.isFinite(price) || price < 0) throw validation('Giá không hợp lệ', 'price');
      }

      const dup = allPlans().some((p) => p.status === 'active' && p.name.trim().toLowerCase() === name.toLowerCase());
      if (dup) throw new MockHttpError(409, 'Đã có gói đang hoạt động trùng tên', 'DUPLICATE_NAME');

      const plan = {
        id: nextPlanId(),
        name,
        description,
        price,
        durationDays,
        status: 'active' as const,
        isFree: price === 0 && planKind === 'fixed',
        planKind,
        basePrice30,
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
      const planKind = b.planKind !== undefined ? normalizePlanKind(b.planKind) : cur.planKind ?? 'fixed';
      const basePrice30 =
        b.basePrice30 !== undefined ? Number(b.basePrice30) : cur.basePrice30 ?? cur.price;
      let price = b.price !== undefined ? Number(b.price) : cur.price;
      let durationDays = b.durationDays !== undefined ? Number(b.durationDays) : cur.durationDays;
      const status = b.status === 'inactive' || b.status === 'active' ? b.status : cur.status;

      if (!name) throw validation('Tên gói bắt buộc', 'name');
      if (!Number.isFinite(basePrice30) || basePrice30 < 0) {
        throw validation('Giá cơ sở 30 ngày không hợp lệ', 'basePrice30');
      }

      if (planKind === 'custom') {
        durationDays = PLAN_MIN_DAYS;
        price = 0;
      } else if (planKind === 'lifetime') {
        durationDays = LIFETIME_DAYS;
        if (!Number.isFinite(price) || price < 0) throw validation('Giá không hợp lệ', 'price');
      } else {
        if (!Number.isInteger(durationDays) || durationDays < 1) {
          throw validation('Số ngày không hợp lệ', 'durationDays');
        }
        if (!Number.isFinite(price) || price < 0) throw validation('Giá không hợp lệ', 'price');
      }

      const updated = {
        ...cur,
        name,
        description,
        price,
        durationDays,
        status,
        isFree: price === 0 && planKind === 'fixed',
        planKind,
        basePrice30,
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
      const cur = list[idx];
      if (cur.status === 'active') {
        const soft = { ...cur, status: 'inactive' as const };
        list[idx] = soft;
        savePlans(list);
        return {
          message: 'Đã ngừng bán gói (xóa mềm). Người dùng đã mua vẫn dùng đến hết hạn.',
          data: soft,
        };
      }
      const removed = list[idx];
      savePlans(list.filter((p) => p.id !== id));
      return {
        message: 'Đã xóa hẳn gói khỏi danh mục. Người dùng đã mua vẫn dùng đến hết hạn.',
        data: removed,
      };
    },
  },

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
      return { message: 'Danh sách user', data: { items } };
    },
  },
  {
    method: 'POST',
    path: '/admin/users/:userId/wallet/topup',
    handler: ({ token, params, body }) => {
      requireAdmin(token);
      const userId = toInt(params.userId);
      const user = allUsers().find((u) => u.id === userId);
      if (!user) throw new MockHttpError(404, 'Không tìm thấy user', 'NOT_FOUND');
      const b = (body ?? {}) as Record<string, unknown>;
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw validation('Số tiền không hợp lệ', 'amount');
      const note = b.note != null ? String(b.note) : null;
      const balance = getWallet(user) + amount;
      setWallet(userId, balance);
      addWalletTx({
        userId,
        type: 'TOPUP',
        amount,
        refType: 'ADMIN',
        refId: null,
      });
      return {
        message: 'Nạp ví thành công',
        data: { userId, amount, balance, note },
      };
    },
  },
];
