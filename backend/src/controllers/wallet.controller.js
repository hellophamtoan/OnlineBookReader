// controllers/wallet.controller.js
// API ví của USER (UC013): tạo yêu cầu nạp, xem trạng thái, số dư, lịch sử.
const { pool, success, posId, money, replyError } = require('../services/week3.common');
const walletService = require('../services/wallet.service');

// [Backend] Giới hạn số dòng mỗi trang.
const clampLimit = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 100) : 50;
};

// [Giao diện] Trang Nạp ví: tạo yêu cầu nạp và hiển thị mã QR chuyển khoản.
// POST /api/wallet/topup
const createTopup = async (req, res) => {
  try {
    const data = await walletService.createTopup(req.user, req.body);
    return success(res, 201, 'Tạo yêu cầu nạp tiền thành công', data);
  } catch (e) { return replyError(res, 'Tạo yêu cầu nạp ví', e); }
};

// [Giao diện] Trang Nạp ví: cập nhật trạng thái yêu cầu nạp (chờ / đã nhận tiền).
// GET /api/wallet/topup/:orderCode
const getTopupStatus = async (req, res) => {
  try {
    const data = await walletService.getTopupStatus(req.user.id, String(req.params.orderCode || '').slice(0, 25));
    return success(res, 200, 'OK', data);
  } catch (e) { return replyError(res, 'Trạng thái nạp ví', e); }
};

// [Giao diện] Trang Nạp ví: hiển thị lịch sử các lần nạp.
// GET /api/wallet/topups?limit=
const listTopups = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${walletService.requestColumns} FROM wallet_topup_requests
       WHERE user_id = ? ORDER BY id DESC LIMIT ${clampLimit(req.query.limit)}`, [req.user.id]
    );
    return success(res, 200, 'Lịch sử yêu cầu nạp ví', { items: rows.map(walletService.mapRequest) });
  } catch (e) { return replyError(res, 'Lịch sử yêu cầu nạp', e); }
};

// [Giao diện] Header / Hồ sơ / Thanh toán: hiển thị số dư ví.
// GET /api/wallet/balance
const getBalance = async (req, res) => {
  try {
    const [[u]] = await pool.execute('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id]);
    return success(res, 200, 'OK', { walletBalance: money(u.wallet_balance) });
  } catch (e) { return replyError(res, 'Số dư ví', e); }
};

// [Giao diện] Trang Ví: hiển thị lịch sử giao dịch (nạp, thanh toán, hoàn tiền).
// GET /api/wallet/transactions?limit=
const listTransactions = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, type, amount, balance_after AS balanceAfter, ref_type AS refType, ref_id AS refId,
              note, external_reference AS externalReference, created_at AS createdAt
       FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT ${clampLimit(req.query.limit)}`, [req.user.id]
    );
    const items = rows.map((t) => ({ ...t, amount: Number(t.amount), balanceAfter: t.balanceAfter == null ? null : Number(t.balanceAfter) }));
    return success(res, 200, 'Lịch sử ví', { items });
  } catch (e) { return replyError(res, 'Lịch sử giao dịch ví', e); }
};

module.exports = { createTopup, getTopupStatus, listTopups, getBalance, listTransactions };
