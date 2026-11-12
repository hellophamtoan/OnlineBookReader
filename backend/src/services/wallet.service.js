// services/wallet.service.js
// Logic nạp ví nhiều bước cần transaction (UC013). Controller chỉ gọi hàm ở đây.
const crypto = require('node:crypto');
const { pool, bad, validation, money, withTx, audit } = require('./week3.common');

const MIN_TOPUP = 10000;
const MAX_TOPUP = 50000000;
const MAX_PENDING_PER_USER = 5;
const MAX_BALANCE = 9999999999;

// ---------- Hàm thuần (dễ test) ----------

// Mã yêu cầu = nội dung chuyển khoản: chỉ chữ + số, in hoa, <= 25 ký tự
const buildOrderCode = (userId) => {
  const time = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 3);
  return `NAP${userId}${time}${rand}`.slice(0, 25);
};

// Link ảnh QR VietQR động (app ngân hàng quét được)
const buildQrUrl = (bank, amount, content) => {
  const q = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: content,
    accountName: bank.accountName,
  });
  return `https://img.vietqr.io/image/${bank.bin}-${bank.accountNo}-print.jpg?${q.toString()}`;
};

const validateTopupBody = (body) => {
  const amount = body?.amount;
  const note = body?.note ?? '';
  const method = String(body?.method ?? body?.gateway ?? 'BANK_QR').toUpperCase();
  if (!Number.isInteger(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    validation('amount', `Số tiền nạp phải từ ${MIN_TOPUP.toLocaleString('vi-VN')} đến ${MAX_TOPUP.toLocaleString('vi-VN')} VNĐ`);
  }
  if (method !== 'BANK_QR') validation('method', 'Hiện chỉ hỗ trợ nạp qua QR chuyển khoản');
  if (typeof note !== 'string' || note.length > 255) validation('note', 'Ghi chú không quá 255 ký tự');
  return { amount, note: note.trim() || null };
};

const validateBankBody = (body) => {
  const bin = String(body?.bin ?? body?.bankBin ?? '').trim();
  const accountNo = String(body?.accountNo ?? '').replace(/\D/g, '');
  const accountName = String(body?.accountName ?? '').trim().toUpperCase();
  const bankName = String(body?.bankName ?? '').trim();
  if (!/^\d{6}$/.test(bin)) validation('bin', 'BIN ngân hàng không hợp lệ');
  if (!/^\d{6,20}$/.test(accountNo)) validation('accountNo', 'Số tài khoản không hợp lệ (6–20 chữ số)');
  if (accountName.length < 3 || accountName.length > 100) validation('accountName', 'Tên chủ tài khoản từ 3 đến 100 ký tự');
  if (bankName.length > 100) validation('bankName', 'Tên ngân hàng quá dài');
  return { bin, accountNo, accountName, bankName: bankName || bin };
};

// ---------- Truy vấn dùng chung ----------

const getBank = async (executor = pool) => {
  const [rows] = await executor.execute(
    'SELECT bin, account_no AS accountNo, account_name AS accountName, bank_name AS bankName FROM store_bank_accounts WHERE id = 1 LIMIT 1'
  );
  return rows[0] || null;
};

const requestColumns = `id, user_id AS userId, order_code AS orderCode, amount, gateway, status, note,
  gateway_txn_id AS gatewayTxnId, paid_at AS paidAt, created_at AS createdAt`;

const mapRequest = (r) => ({
  id: r.id,
  amount: money(r.amount),
  gateway: r.gateway,
  status: r.status,
  orderCode: r.orderCode,
  transferContent: r.orderCode,
  note: r.note,
  gatewayTxnId: r.gatewayTxnId,
  paidAt: r.paidAt,
  createdAt: r.createdAt,
});

// ---------- USER: tạo yêu cầu nạp ----------

const createTopup = async (user, body) => {
  const { amount, note } = validateTopupBody(body);
  const bank = await getBank();
  if (!bank) bad(409, 'BANK_NOT_CONFIGURED', 'Cửa hàng chưa cấu hình tài khoản nhận tiền, vui lòng quay lại sau');

  const [[pending]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM wallet_topup_requests WHERE user_id = ? AND status = 'PENDING'`, [user.id]
  );
  if (Number(pending.total) >= MAX_PENDING_PER_USER) {
    bad(409, 'TOO_MANY_PENDING_TOPUPS', `Bạn đang có ${MAX_PENDING_PER_USER} yêu cầu nạp chờ xác nhận, vui lòng chờ xử lý`);
  }

  const orderCode = buildOrderCode(user.id);
  const [added] = await pool.execute(
    `INSERT INTO wallet_topup_requests (user_id, order_code, amount, gateway, status, note)
     VALUES (?, ?, ?, 'BANK_QR', 'PENDING', ?)`, [user.id, orderCode, amount, note]
  );
  const qrImageUrl = buildQrUrl(bank, amount, orderCode);
  return {
    id: added.insertId,
    orderCode,
    amount,
    gateway: 'BANK_QR',
    paymentUrl: qrImageUrl,
    qrImageUrl,
    transferContent: orderCode,
    bank,
    status: 'PENDING',
    message: 'Quét QR / chuyển khoản đúng nội dung. Ví chỉ được cộng sau khi quản trị viên xác nhận đã nhận tiền.',
  };
};

const getTopupStatus = async (userId, orderCode) => {
  const [rows] = await pool.execute(
    `SELECT ${requestColumns} FROM wallet_topup_requests WHERE order_code = ? AND user_id = ? LIMIT 1`,
    [orderCode, userId]
  );
  if (!rows.length) bad(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu nạp tiền');
  const [[u]] = await pool.execute('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
  const bank = await getBank();
  const row = mapRequest(rows[0]);
  return {
    ...row,
    walletBalance: money(u.wallet_balance),
    qrImageUrl: bank ? buildQrUrl(bank, row.amount, row.orderCode) : null,
    bank,
  };
};

// ---------- ADMIN: xác nhận đã nhận tiền -> cộng ví ----------

const confirmTopup = async (adminId, userId, orderCode) => {
  return withTx(async (conn) => {
    // Khóa dòng yêu cầu: 2 admin bấm cùng lúc thì chỉ 1 người cộng được
    const [rows] = await conn.execute(
      `SELECT id, user_id, amount, status, paid_at FROM wallet_topup_requests
       WHERE order_code = ? AND user_id = ? FOR UPDATE`, [orderCode, userId]
    );
    if (!rows.length) bad(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu nạp');
    const reqRow = rows[0];
    const amount = money(reqRow.amount);

    const [[user]] = await conn.execute('SELECT id, role, wallet_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!user || user.role !== 'USER') bad(404, 'NOT_FOUND', 'Không tìm thấy tài khoản USER');

    if (reqRow.status === 'PAID') {
      return { already: true, userId, orderCode, amount, balance: money(user.wallet_balance), status: 'PAID', paidAt: reqRow.paid_at };
    }
    if (reqRow.status !== 'PENDING') bad(400, 'INVALID_STATUS', `Không thể nạp ở trạng thái ${reqRow.status}`);
    if (money(user.wallet_balance) + amount > MAX_BALANCE) validation('amount', 'Số dư ví vượt giới hạn cho phép');

    // Cộng ví + ghi lịch sử + đổi trạng thái trong CÙNG transaction
    await conn.execute('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, userId]);
    const [[after]] = await conn.execute('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
    const balance = money(after.wallet_balance);
    // external_reference là UNIQUE: chốt chặn thứ 2 chống cộng trùng 1 yêu cầu
    const [tx] = await conn.execute(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, ref_type, ref_id, note, external_reference)
       VALUES (?, 'TOPUP', ?, ?, 'TOPUP_REQUEST', ?, ?, ?)`,
      [userId, amount, balance, reqRow.id, `Nạp ví QR ${orderCode}`, orderCode]
    );
    const txnId = `ADMIN-${adminId}-${Date.now()}`;
    await conn.execute(
      `UPDATE wallet_topup_requests SET status = 'PAID', paid_at = NOW(), confirmed_by = ?, gateway_txn_id = ? WHERE id = ?`,
      [adminId, txnId, reqRow.id]
    );
    await audit(conn, adminId, 'WALLET_TOPUP_CONFIRM', 'USER', userId, { amount, orderCode, requestId: reqRow.id, transactionId: tx.insertId });
    return { already: false, userId, orderCode, amount, balance, walletBalance: balance, status: 'PAID', paidAt: new Date().toISOString() };
  });
};

module.exports = {
  MIN_TOPUP, MAX_TOPUP,
  buildOrderCode, buildQrUrl, validateTopupBody, validateBankBody,
  getBank, requestColumns, mapRequest,
  createTopup, getTopupStatus, confirmTopup,
};
