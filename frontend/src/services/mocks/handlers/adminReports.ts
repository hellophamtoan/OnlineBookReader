// UC011 — Thống kê & báo cáo (API-69..72) — chỉ số đầy đủ cho báo cáo Excel
import { toInt } from '../http';
import type { Route } from '../router';
import { allUsers } from '../db';
import { allOrders } from '../shopdb';
import { allPlans, allSubscriptions, hasActiveSubscription } from '../subscriptiondb';
import { requireAdmin } from './guards';

function parseRange(query: URLSearchParams) {
  const to = query.get('to') || new Date().toISOString().slice(0, 10);
  let from = query.get('from') || '';
  if (!from) {
    const d = new Date(to + 'T00:00:00');
    d.setDate(d.getDate() - 29);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

function inRange(iso: string, from: string, to: string) {
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

function addDays(ymd: string, delta: number) {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Kỳ trước có cùng số ngày */
function previousRange(from: string, to: string) {
  const start = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

function metricsFor(from: string, to: string) {
  const orders = allOrders().filter((o) => inRange(o.createdAt, from, to));
  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const cancelled = orders.filter((o) => o.status === 'CANCELLED');
  const orderRevenue = delivered.reduce((s, o) => s + o.totalAmount, 0);
  const subs = allSubscriptions().filter((s) => inRange(s.startDate, from, to));
  const planRevenue = subs.reduce((s, x) => s + x.pricePaid, 0);
  const grossRevenue = orderRevenue + planRevenue;
  let productsSold = 0;
  for (const o of delivered) {
    for (const it of o.items) productsSold += it.quantity;
  }
  const avgOrderValue = delivered.length ? Math.round(orderRevenue / delivered.length) : 0;

  const payMap = new Map<string, { method: string; orderCount: number; revenue: number }>();
  for (const o of delivered) {
    const cur = payMap.get(o.paymentMethod) ?? { method: o.paymentMethod, orderCount: 0, revenue: 0 };
    cur.orderCount += 1;
    cur.revenue += o.totalAmount;
    payMap.set(o.paymentMethod, cur);
  }

  const countBy = (st: string) => orders.filter((o) => o.status === st).length;

  return {
    grossRevenue,
    orderRevenue,
    planRevenue,
    productsSold,
    avgOrderValue,
    deliveredCount: delivered.length,
    cancelledCount: cancelled.length,
    orders: {
      total: orders.length,
      pending: countBy('PENDING'),
      confirmed: countBy('PREPARING'),
      shipping: countBy('SHIPPING'),
      delivered: countBy('DELIVERED'),
      cancelled: countBy('CANCELLED'),
      failed: countBy('FAILED'),
    },
    paymentMethods: [...payMap.values()].sort((a, b) => b.revenue - a.revenue),
    subscriptionsNew: subs.length,
  };
}

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const adminReportRoutes: Route[] = [
  {
    method: 'GET',
    path: '/admin/reports/overview',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const { from, to } = parseRange(query);
      const cur = metricsFor(from, to);
      const prevR = previousRange(from, to);
      const prev = metricsFor(prevR.from, prevR.to);
      const users = allUsers().filter((u) => u.role === 'USER');
      const activeUsers = users.filter((u) => u.isActive).length;
      const usersOnPlan = users.filter((u) => hasActiveSubscription(u.id)).length;
      // Kỳ trước: user có gói giao với khoảng prev; user active (snapshot) giữ cùng công thức isActive
      const usersOnPlanPrev = users.filter((u) => {
        const nowFrom = Date.parse(prevR.from + 'T00:00:00');
        const nowTo = Date.parse(prevR.to + 'T23:59:59');
        return allSubscriptions().some((s) => {
          const a = Date.parse(s.startDate);
          const b = Date.parse(s.endDate);
          return a <= nowTo && b >= nowFrom;
        });
      }).length;

      return {
        message: 'OK',
        data: {
          from,
          to,
          revenue: {
            orderRevenue: cur.orderRevenue,
            planRevenue: cur.planRevenue,
            total: cur.grossRevenue,
          },
          orders: cur.orders,
          subscriptions: {
            newCount: cur.subscriptionsNew,
            activeUsers: usersOnPlan,
            lifetimeCount: allSubscriptions().filter((s) => (s as { planKind?: string }).planKind === 'lifetime')
              .length,
          },
          users: {
            newUsers: users.length,
            activeUsers,
          },
          metrics: {
            grossRevenue: cur.grossRevenue,
            deliveredOrders: cur.deliveredCount,
            cancelledOrders: cur.cancelledCount,
            productsSold: cur.productsSold,
            avgOrderValue: cur.avgOrderValue,
            growthPercent: growthPct(cur.grossRevenue, prev.grossRevenue),
            deliveredGrowthPercent: growthPct(cur.deliveredCount, prev.deliveredCount),
            activeUsers,
            usersOnPlan,
          },
          previousPeriod: {
            from: prevR.from,
            to: prevR.to,
            grossRevenue: prev.grossRevenue,
            deliveredOrders: prev.deliveredCount,
            cancelledOrders: prev.cancelledCount,
            productsSold: prev.productsSold,
            avgOrderValue: prev.avgOrderValue,
            activeUsers,
            usersOnPlan: usersOnPlanPrev,
            orderRevenue: prev.orderRevenue,
            planRevenue: prev.planRevenue,
          },
          paymentMethods: cur.paymentMethods,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/admin/reports/revenue',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const { from, to } = parseRange(query);
      const groupBy = query.get('groupBy') || 'day';
      const pointsMap = new Map<string, { orderRevenue: number; planRevenue: number }>();

      const ensure = (label: string) => {
        if (!pointsMap.has(label)) pointsMap.set(label, { orderRevenue: 0, planRevenue: 0 });
        return pointsMap.get(label)!;
      };

      for (const o of allOrders()) {
        if (o.status !== 'DELIVERED' || !inRange(o.createdAt, from, to)) continue;
        ensure(o.createdAt.slice(0, 10)).orderRevenue += o.totalAmount;
      }
      for (const s of allSubscriptions()) {
        if (!inRange(s.startDate, from, to)) continue;
        ensure(s.startDate.slice(0, 10)).planRevenue += s.pricePaid;
      }

      const points = [...pointsMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([label, v]) => ({
          label,
          orderRevenue: v.orderRevenue,
          planRevenue: v.planRevenue,
          total: v.orderRevenue + v.planRevenue,
        }));

      // Gộp theo tháng nếu groupBy=month
      if (groupBy === 'month') {
        const mMap = new Map<string, { orderRevenue: number; planRevenue: number }>();
        for (const p of points) {
          const key = p.label.slice(0, 7);
          const cur = mMap.get(key) ?? { orderRevenue: 0, planRevenue: 0 };
          cur.orderRevenue += p.orderRevenue;
          cur.planRevenue += p.planRevenue;
          mMap.set(key, cur);
        }
        const monthPoints = [...mMap.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([label, v]) => ({
            label,
            orderRevenue: v.orderRevenue,
            planRevenue: v.planRevenue,
            total: v.orderRevenue + v.planRevenue,
          }));
        return { message: 'OK', data: { from, to, groupBy: 'month', points: monthPoints } };
      }

      return { message: 'OK', data: { from, to, groupBy, points } };
    },
  },
  {
    method: 'GET',
    path: '/admin/reports/best-sellers',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const { from, to } = parseRange(query);
      const limit = Math.min(50, Math.max(1, toInt(query.get('limit')) || 10));
      const map = new Map<number, { bookId: number; title: string; quantitySold: number; revenue: number }>();

      for (const o of allOrders()) {
        if (o.status !== 'DELIVERED' || !inRange(o.createdAt, from, to)) continue;
        for (const it of o.items) {
          const cur = map.get(it.bookId) ?? {
            bookId: it.bookId,
            title: it.title,
            quantitySold: 0,
            revenue: 0,
          };
          cur.quantitySold += it.quantity;
          cur.revenue += it.subtotal;
          map.set(it.bookId, cur);
        }
      }

      const items = [...map.values()]
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, limit)
        .map((x) => ({ ...x, coverUrl: null as string | null }));

      return { message: 'OK', data: { items } };
    },
  },
  {
    method: 'GET',
    path: '/admin/reports/subscriptions',
    handler: ({ token, query }) => {
      requireAdmin(token);
      const { from, to } = parseRange(query);
      const subs = allSubscriptions().filter((s) => inRange(s.startDate, from, to));
      const plans = allPlans();
      const byPlanMap = new Map<
        number,
        { planId: number; planName: string; planType: string; count: number; revenue: number }
      >();

      for (const s of subs) {
        const p = plans.find((x) => x.id === s.planId);
        const cur = byPlanMap.get(s.planId) ?? {
          planId: s.planId,
          planName: s.planName,
          planType: p?.planKind ?? 'fixed',
          count: 0,
          revenue: 0,
        };
        cur.count += 1;
        cur.revenue += s.pricePaid;
        byPlanMap.set(s.planId, cur);
      }

      return {
        message: 'OK',
        data: {
          from,
          to,
          byPlan: [...byPlanMap.values()].sort((a, b) => b.count - a.count),
          newSubscriptions: subs.length,
          freeClaims: subs.filter((s) => s.pricePaid <= 0).length,
        },
      };
    },
  },
];
