// controllers/wallet.topup.admin.controller.js
// API quản trị nạp ví QR (UC013): tài khoản nhận tiền, lịch sử nạp của user, xác nhận đã nhận tiền.
const { pool, success, posId, money, validation, replyError } = require('../services/week3.common');
const { audit } = require('../services/week3.common');
const walletService = require('../services/wallet.service');

// GET /api/admin/store/bank-account
const getBankAccount = async (req, res) => {
  try {
    const bank = await walletService.getBank();
    return success(res, 200, 'OK', {
      configured: !!bank,
      bank: bank ? { ...bank, source: 'db' } : null,
      hint: 'BIN được hệ thống gắn theo ngân hàng đã chọn.',
    });
  } catch (e) { return replyError(res, 'Lấy tài khoản nhận tiền', e); }
};

// PUT /api/admin/store/bank-account
const updateBankAccount = async (req, res) => {
  try {
    const b = walletService.validateBankBody(req.body);
    await pool.execute(
      `INSERT INTO store_bank_accounts (id, bin, account_no, account_name, bank_name, updated_by)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE bin = VALUES(bin), account_no = VALUES(account_no),
         account_name = VALUES(account_name), bank_name = VALUES(bank_name), updated_by = VALUES(updated_by)`,
      [b.bin, b.accountNo, b.accountName, b.bankName, req.user.id]
    );
    await audit(pool, req.user.id, 'STORE_BANK_UPDATE', 'STORE', 1, { bin: b.bin, accountNo: b.accountNo });
    return success(res, 200, 'Đã cập nhật tài khoản nhận tiền của cửa hàng', { configured: true, bank: { ...b, source: 'db' } });
  } catch (e) { return replyError(res, 'Cập nhật tài khoản nhận tiền', e); }
};

// GET /api/admin/users/:id/wallet/topups
const userTopupHistory = async (req, res) => {
  try {
    const id = posId(req.params.id);
    if (!id) validation('id', 'Mã người dùng không hợp lệ');
    const [[u]] = await pool.execute(
      `SELECT id, full_name AS fullName, email, wallet_balance FROM users WHERE id = ? AND role = 'USER'`, [id]
    );
    if (!u) return require('../utils/response').fail(res, 404, 'Không tìm thấy tài khoản USER', 'NOT_FOUND');
    const [requests] = await pool.execute(
      `SELECT ${walletService.requestColumns} FROM wallet_topup_requests WHERE user_id = ? ORDER BY id DESC LIMIT 100`, [id]
    );
    const [txs] = await pool.execute(
      `SELECT id, type, amount, balance_after AS balanceAfter, note, external_reference AS externalReference, created_at AS createdAt
       FROM wallet_transactions WHERE user_id = ? AND type = 'TOPUP' ORDER BY id DESC LIMIT 100`, [id]
    );
    return success(res, 200, 'Lịch sử nạp ví', {
      user: { id: u.id, fullName: u.fullName, email: u.email, walletBalance: money(u.wallet_balance) },
      transactions: txs.map((t) => ({ ...t, amount: Number(t.amount), balanceAfter: t.balanceAfter == null ? null : Number(t.balanceAfter) })),
      requests: requests.map(walletService.mapRequest),
    });
  } catch (e) { return replyError(res, 'Lịch sử nạp ví của user', e); }
};

// POST /api/admin/users/:id/wallet/topups/:orderCode/confirm
const confirmTopup = async (req, res) => {
  try {
    const userId = posId(req.params.id);
    if (!userId) validation('id', 'Mã người dùng không hợp lệ');
    const orderCode = String(req.params.orderCode || '').trim().slice(0, 25);
    const result = await walletService.confirmTopup(req.user.id, userId, orderCode);
    const { already, ...data } = result;
    return success(res, 200, already ? 'Yêu cầu đã được nạp trước đó' : 'Đã nạp ví thành công', data);
  } catch (e) { return replyError(res, 'Xác nhận nạp ví', e); }
};

module.exports = { getBankAccount, updateBankAccount, userTopupHistory, confirmTopup };
