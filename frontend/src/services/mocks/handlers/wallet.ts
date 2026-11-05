// Mock nạp ví bằng QR chuyển khoản (VietQR) — FE độc lập
import type { Route } from '../router';
import { MockHttpError } from '../http';
import { requireUser } from './auth';
import { requireCustomer } from './guards';
import { failValidation, str, toNumber } from './common';
import {
  adjustWallet,
  allTopups,
  createTopupRequest,
  findTopupByCode,
  getWallet,
  updateTopup,
  walletTransactions,
  type TopupGateway,
  getStoreBank,
} from '../shopdb';

const MIN_TOPUP = 10_000;
const MAX_TOPUP = 50_000_000;

// Tài khoản demo: MB 098980884 NGUYEN VAN HA (mặc định từ getStoreBank)
const MOCK_BANK = () => {
  const b = getStoreBank();
  return { ...b, bankName: b.bankName || 'Ngân hàng' };
};

const buildOrderCode = (userId: number) =>
  `TOPUP${userId}${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const transferContent = (orderCode: string) =>
  String(orderCode).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);

const vietQrUrl = (amount: number, orderCode: string) => {
  const bank = MOCK_BANK();
  const content = transferContent(orderCode);
  const accountNo = String(bank.accountNo).replace(/\D/g, '');
  const bin = String(bank.bin).replace(/\D/g, '');
  const accountName = String(bank.accountName || '').trim().toUpperCase();
  const q = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: content,
    accountName,
  });
  // template print: QR chuẩn VietQR/NAPAS, app ngân hàng quét được
  return `https://img.vietqr.io/image/${bin}-${accountNo}-print.jpg?${q.toString()}`;
};

export const walletRoutes: Route[] = [
  {
    method: 'POST',
    path: '/wallet/topup',
    handler: ({ token, body }) => {
      const user = requireUser(token);
      if (user.role !== 'USER') throw new MockHttpError(403, 'Chỉ người dùng mới được nạp ví', 'FORBIDDEN');

      const b = (body ?? {}) as Record<string, unknown>;
      const amount = toNumber(b.amount);
      const method = (str(b.method || b.gateway || 'BANK_QR').toUpperCase() || 'BANK_QR') as TopupGateway | 'BANK_QR';
      const note = str(b.note).trim().slice(0, 255);

      if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
        throw failValidation([
          {
            field: 'amount',
            message: `Số tiền nạp phải từ ${MIN_TOPUP.toLocaleString('vi-VN')} đến ${MAX_TOPUP.toLocaleString('vi-VN')} VNĐ`,
          },
        ]);
      }

      const orderCode = buildOrderCode(user.id);
      const content = transferContent(orderCode);
      // QR VietQR động từ TK admin đã cấu hình (Ngân hàng + STK)
      const qrImageUrl = vietQrUrl(amount, orderCode);

      const row = createTopupRequest({
        userId: user.id,
        amount,
        gateway: 'BANK_QR' as TopupGateway,
        orderCode,
        paymentUrl: qrImageUrl,
        note: note || null,
      });

      // Mock: sau 8 giây tự coi như đã nhận CK (giả lập webhook ngân hàng)
      const uid = user.id;
      setTimeout(() => {
        try {
          const current = findTopupByCode(orderCode);
          if (!current || current.status !== 'PENDING') return;
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { findUserById } = require('../db');
          const u = findUserById(uid);
          if (!u) return;
          adjustWallet(u, amount, {
            type: 'TOPUP',
            refType: 'TOPUP_REQUEST',
            refId: row.id,
            note: content,
            externalReference: content,
          });
          updateTopup(orderCode, {
            status: 'PAID',
            gatewayTxnId: `MOCK-BANK-${Date.now()}`,
            paidAt: new Date().toISOString(),
          });
        } catch {
          /* ignore */
        }
      }, 8000);

      return {
        status: 201,
        message: 'Tạo yêu cầu nạp tiền thành công',
        data: {
          id: row.id,
          orderCode,
          amount,
          gateway: 'BANK_QR',
          paymentUrl: qrImageUrl,
          qrImageUrl,
          transferContent: content,
          bank: MOCK_BANK(),
          status: 'PENDING',
          expiresInSeconds: 1800,
          message:
            'MOCK: quét QR hoặc đợi ~8 giây hệ thống giả lập nhận tiền và cộng ví. Nội dung CK phải khớp mã.',
        },
      };
    },
  },

  {
    method: 'POST',
    path: '/wallet/topup/bank-webhook',
    handler: ({ body }) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const amount = toNumber(b.transferAmount ?? b.amount);
      const content = str(b.content ?? b.description).replace(/\s+/g, '').toUpperCase();
      if (!amount || !content) throw failValidation([{ field: 'content', message: 'Thiếu nội dung hoặc số tiền' }]);

      // Tìm trong storage — shopdb allTopups
      const { allTopups } = require('../shopdb') as typeof import('../shopdb');
      const pending = allTopups().filter((t) => t.status === 'PENDING' && t.amount === amount);
      const matched = pending.find((t) => {
        const code = transferContent(t.orderCode).toUpperCase();
        return content.includes(code) || content.includes(t.orderCode.toUpperCase());
      });
      if (!matched) {
        return { message: 'Không khớp giao dịch', data: { matched: false } };
      }
      // Cần user object — lấy balance qua adjust cần MockUser
      const { findUserById } = require('../db');
      const user = findUserById(matched.userId);
      if (!user) throw new MockHttpError(404, 'User không tồn tại', 'NOT_FOUND');
      const ck = transferContent(matched.orderCode);
      const bal = adjustWallet(user, matched.amount, {
        type: 'TOPUP',
        refType: 'TOPUP_REQUEST',
        refId: matched.id,
        note: ck,
        externalReference: ck,
      });
      updateTopup(matched.orderCode, {
        status: 'PAID',
        gatewayTxnId: `WH-${Date.now()}`,
        paidAt: new Date().toISOString(),
      });
      return {
        message: 'Đã cộng ví',
        data: { matched: true, orderCode: matched.orderCode, walletBalance: bal },
      };
    },
  },

  {
    method: 'GET',
    path: '/wallet/topup/:orderCode',
    handler: ({ token, params }) => {
      const user = requireUser(token);
      const orderCode = decodeURIComponent(params.orderCode || '');
      const row = findTopupByCode(orderCode);
      if (!row || row.userId !== user.id) {
        throw new MockHttpError(404, 'Không tìm thấy yêu cầu nạp tiền', 'NOT_FOUND');
      }
      const content = transferContent(row.orderCode);
      return {
        message: 'OK',
        data: {
          id: row.id,
          amount: row.amount,
          gateway: row.gateway,
          status: row.status,
          orderCode: row.orderCode,
          gatewayTxnId: row.gatewayTxnId,
          paidAt: row.paidAt,
          createdAt: row.createdAt,
          walletBalance: getWallet(user),
          qrImageUrl: vietQrUrl(row.amount, row.orderCode),
          transferContent: content,
          bank: MOCK_BANK(),
        },
      };
    },
  },

  {
    method: 'GET',
    path: '/wallet/balance',
    handler: ({ token }) => {
      const user = requireUser(token);
      return { message: 'OK', data: { walletBalance: getWallet(user) } };
    },
  },

  {
    method: 'GET',
    path: '/wallet/transactions',
    handler: ({ token, query }) => {
      const user = requireUser(token);
      const limitRaw = Number(query.get('limit') || 50);
      const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50), 100);
      const items = walletTransactions(user.id)
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter ?? null,
          refType: t.refType,
          refId: t.refId,
          note: t.note ?? null,
          externalReference: t.externalReference ?? null,
          createdAt: t.createdAt,
        }));
      return { message: 'Lịch sử ví', data: { items } };
    },
  },

  {
    method: 'GET',
    path: '/wallet/topups',
    handler: ({ token, query }) => {
      const user = requireCustomer(token);
      const limit = Math.min(Number(query?.limit) || 50, 100);
      const items = allTopups()
        .filter((r) => r.userId === user.id)
        .slice(0, limit)
        .map((r) => ({
          id: r.id,
          amount: r.amount,
          gateway: r.gateway,
          status: r.status,
          orderCode: r.orderCode,
          transferContent: transferContent(r.orderCode),
          note: r.note,
          paidAt: r.paidAt,
          createdAt: r.createdAt,
          gatewayTxnId: r.gatewayTxnId,
        }));
      return { message: 'Lịch sử yêu cầu nạp ví', data: { items } };
    },
  },
];
