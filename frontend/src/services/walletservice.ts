// services/walletservice.ts — nạp ví qua QR chuyển khoản (VietQR) / VNPay / MoMo
import { api } from './api';
import { ENDPOINTS } from './endpoints';

export type TopupMethod = 'BANK_QR' | 'VNPAY' | 'MOMO';

export interface TopupBankInfo {
  bin: string;
  accountNo: string;
  accountName: string;
  bankName: string;
}

export interface TopupResult {
  id: number;
  orderCode: string;
  amount: number;
  gateway: TopupMethod;
  paymentUrl: string | null;
  status: string;
  qrImageUrl?: string | null;
  transferContent?: string | null;
  bank?: TopupBankInfo | null;
  expiresInSeconds?: number;
  message?: string;
}

export interface TopupStatus {
  id: number;
  amount: number;
  gateway: string;
  status: string;
  orderCode: string;
  gatewayTxnId: string | null;
  paidAt: string | null;
  createdAt: string;
  walletBalance: number;
  qrImageUrl?: string | null;
  transferContent?: string | null;
  bank?: TopupBankInfo | null;
}

export interface WalletTxItem {
  id: number;
  type: string;
  amount: number;
  balanceAfter?: number | null;
  note?: string | null;
  externalReference?: string | null;
  createdAt: string;
}

/** Yêu cầu nạp QR: PENDING = chờ xác nhận, PAID = đã nạp */
export interface TopupRequestItem {
  id: number;
  amount: number;
  gateway: string;
  status: string;
  orderCode: string;
  transferContent?: string | null;
  note?: string | null;
  paidAt?: string | null;
  createdAt: string;
  gatewayTxnId?: string | null;
}

export const walletService = {
  // [Gọi API] POST /wallet/topup – tạo yêu cầu nạp, nhận mã QR.
  async createTopup(amount: number, method: TopupMethod = 'BANK_QR', note?: string): Promise<TopupResult> {
    const res = await api.post(ENDPOINTS.wallet.topup, { amount, method, note: note || undefined });
    return res.data as TopupResult;
  },

  // [Gọi API] GET /wallet/topup/:mã – kiểm tra yêu cầu nạp đã được xác nhận chưa.
  async getStatus(orderCode: string): Promise<TopupStatus> {
    const res = await api.get(ENDPOINTS.wallet.topupStatus(orderCode));
    return res.data as TopupStatus;
  },

  // [Gọi API] GET /wallet/balance – số dư ví.
  async getBalance(): Promise<number> {
    const res = await api.get(ENDPOINTS.wallet.balance);
    return Number((res.data as { walletBalance: number }).walletBalance);
  },

  // [Gọi API] GET /wallet/transactions – lịch sử giao dịch ví.
  async listTransactions(limit = 50): Promise<WalletTxItem[]> {
    const res = await api.get(ENDPOINTS.wallet.transactions, { limit });
    const data = res.data as { items?: WalletTxItem[] };
    return Array.isArray(data?.items) ? data.items : [];
  },

  // [Gọi API] GET /wallet/topups – lịch sử yêu cầu nạp.
  async listTopupRequests(limit = 50): Promise<TopupRequestItem[]> {
    const res = await api.get(ENDPOINTS.wallet.topups, { limit });
    const data = res.data as { items?: TopupRequestItem[] };
    return Array.isArray(data?.items) ? data.items : [];
  },
};
