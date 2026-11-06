// Mock: tài khoản nhận tiền + lịch sử nạp ví user (admin)
import type { Route } from '../router';
import { MockHttpError } from '../http';
import { requireAdmin } from './guards';
import { failValidation, str, idParam } from './common';
import { findUserById } from '../db';
import {
  getStoreBank,
  setStoreBank,
  getWallet,
  walletTransactions,
  allTopups,
  findTopupByCode,
  updateTopup,
  adjustWallet,
} from '../shopdb';

export const adminWalletRoutes: Route[] = [
  {
    method: 'GET',
    path: '/admin/store/bank-account',
    handler: ({ token }) => {
      requireAdmin(token);
      const bank = getStoreBank();
      return {
        message: 'OK',
        data: {
          configured: true,
          bank: {
            bin: bank.bin,
            accountNo: bank.accountNo,
            accountName: bank.accountName,
            bankName: bank.bankName,
            source: 'db',
          },
          hint: 'BIN được hệ thống gắn theo ngân hàng đã chọn.',
        },
      };
    },
  },
  {
    method: 'PUT',
    path: '/admin/store/bank-account',
    handler: ({ token, body }) => {
      requireAdmin(token);
      const b = (body ?? {}) as Record<string, unknown>;
      const bin = str(b.bin || b.bankBin).trim();
      const accountNo = str(b.accountNo).replace(/\D/g, '');
      const accountName = str(b.accountName).trim().toUpperCase();
      const bankName = str(b.bankName).trim();
      if (!/^\d{6}$/.test(bin)) throw failValidation([{ field: 'bin', message: 'BIN ngân hàng không hợp lệ' }]);
      if (!/^\d{6,20}$/.test(accountNo)) throw failValidation([{ field: 'accountNo', message: 'Số TK không hợp lệ' }]);
      if (accountName.length < 3) throw failValidation([{ field: 'accountName', message: 'Tên chủ TK quá ngắn' }]);
      const bank = {
        bin,
        accountNo,
        accountName,
        bankName: bankName || getStoreBank().bankName,
        qrImageUrl: null as string | null,
      };
      setStoreBank(bank);
      return {
        message: 'Đã cập nhật tài khoản nhận tiền của cửa hàng',
        data: {
          bank: {
            bin: bank.bin,
            accountNo: bank.accountNo,
            accountName: bank.accountName,
            bankName: bank.bankName,
            source: 'db',
          },
          configured: true,
        },
      };
    },
  },
  {
    method: 'GET',
    path: '/admin/users/:id/wallet/topups',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const id = idParam(params.id);
      const u = findUserById(id);
      if (!u || u.role !== 'USER') throw new MockHttpError(404, 'Không tìm thấy USER', 'NOT_FOUND');
      const txs = walletTransactions(id)
        .filter((t) => t.type === 'TOPUP')
        .map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          balanceAfter: t.balanceAfter ?? null,
          note: t.note ?? null,
          externalReference: t.externalReference ?? null,
          createdAt: t.createdAt,
        }));
      const requests = allTopups()
        .filter((r) => r.userId === id)
        .map((r) => ({
          id: r.id,
          amount: r.amount,
          gateway: r.gateway,
          status: r.status,
          orderCode: r.orderCode,
          gatewayTxnId: r.gatewayTxnId,
          paidAt: r.paidAt,
          createdAt: r.createdAt,
          note: r.note,
        }));
      return {
        message: 'Lịch sử nạp ví',
        data: {
          user: {
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            walletBalance: getWallet(u),
          },
          transactions: txs,
          requests,
        },
      };
    },
  },

  {
    method: 'POST',
    path: '/admin/users/:id/wallet/topups/:orderCode/confirm',
    handler: ({ token, params }) => {
      requireAdmin(token);
      const userId = idParam(params.id);
      const orderCode = decodeURIComponent(params.orderCode || '');
      const u = findUserById(userId);
      if (!u || u.role !== 'USER') throw new MockHttpError(404, 'Không tìm thấy USER', 'NOT_FOUND');
      const row = findTopupByCode(orderCode);
      if (!row || row.userId !== userId) {
        throw new MockHttpError(404, 'Không tìm thấy yêu cầu nạp', 'NOT_FOUND');
      }
      if (row.status === 'PAID') {
        return {
          message: 'Yêu cầu đã được nạp trước đó',
          data: {
            userId,
            orderCode,
            amount: row.amount,
            balance: getWallet(u),
            status: 'PAID',
            paidAt: row.paidAt || new Date().toISOString(),
          },
        };
      }
      if (row.status !== 'PENDING') {
        throw new MockHttpError(400, `Không thể nạp ở trạng thái ${row.status}`, 'INVALID_STATUS');
      }
      const content = String(row.orderCode).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
      const balance = adjustWallet(u, row.amount, {
        type: 'TOPUP',
        refType: 'TOPUP_REQUEST',
        refId: row.id,
        note: content,
        externalReference: content,
      });
      const paidAt = new Date().toISOString();
      updateTopup(orderCode, { status: 'PAID', paidAt, gatewayTxnId: `ADMIN-${Date.now()}` });
      return {
        message: 'Đã nạp ví thành công',
        data: {
          userId,
          orderCode,
          amount: row.amount,
          balance,
          status: 'PAID',
          paidAt,
        },
      };
    },
  },
];
