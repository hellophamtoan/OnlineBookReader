const crypto = require('node:crypto');
const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
class BusinessError extends Error {
  constructor(status, code, message, errors) { super(message); this.status = status; this.code = code; this.errors = errors; }
}
// [Backend] Ném lỗi nghiệp vụ kèm mã HTTP.
const bad = (status, code, message, errors) => { throw new BusinessError(status, code, message, errors); };
// [Backend] Kiểm tra mã là số nguyên dương.
const posId = v => typeof v !== 'boolean' && /^\d+$/.test(String(v)) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
// [Backend] Kiểm tra số lượng 1–99.
const qty = v => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99 ? v : null;
// [Backend] Kiểm tra số tiền nguyên VND.
const intMoney = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 9999999999 ? Number(v) : null;
// [Backend] Đổi tiền từ DB sang số nguyên VND.
const money = v => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(n)) bad(500, 'INVALID_MONEY', 'Dữ liệu giá tiền không hợp lệ'); return n; };
// [Backend] Cắt khoảng trắng và giới hạn độ dài chuỗi.
const trimmed = (v, max) => typeof v === 'string' && v.trim().length <= max ? v.trim() : null;
// [Backend] Ném lỗi 400 cho một trường dữ liệu.
const validation = (field, message) => bad(400, 'VALIDATION_ERROR', message, [{field, message}]);
// [Backend] Trả lỗi nghiệp vụ hoặc lỗi 500 về frontend.
const replyError = (res, context, err) => err instanceof BusinessError ? fail(res, err.status, err.message, err.code, err.errors) : serverError(res, context, err);
// [Backend] Chạy hàm trong transaction (lỗi thì rollback).
const withTx = async fn => {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const result = await fn(conn); await conn.commit(); return result; }
  catch (err) { try { await conn.rollback(); } catch (rollbackError) { console.error('[Rollback]', rollbackError); } throw err; }
  finally { conn.release(); }
};
// [Backend] Sắp xếp khóa object để băm ổn định.
const sortObj = value => Array.isArray(value) ? value.map(sortObj) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sortObj(value[k])])) : value;
// [Backend] Băm SHA-256 nội dung request.
const hashPayload = value => crypto.createHash('sha256').update(JSON.stringify(sortObj(value))).digest('hex');
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// [Backend] Chống gửi trùng (Idempotency-Key): bấm Đặt hàng / Mua gói hai lần chỉ xử lý một lần.
// Must be called WITHIN same transaction as business write.
const claimRequest = async (conn, req, operation, payload) => {
  const key = req.get('Idempotency-Key');
  if (typeof key !== 'string' || !uuidRegex.test(key)) validation('Idempotency-Key', 'Thiếu hoặc sai Idempotency-Key (UUID)');
  const requestHash = hashPayload(payload);
  await conn.execute(
    `INSERT IGNORE INTO idempotency_requests (user_id,operation,idempotency_key,request_hash,status)
     VALUES (?,?,?,?,'PROCESSING')`, [req.user.id, operation, key, requestHash]
  );
  const [[record]] = await conn.execute(
    `SELECT id, request_hash, status, response_status, response_body
     FROM idempotency_requests WHERE user_id=? AND operation=? AND idempotency_key=? FOR UPDATE`,
    [req.user.id, operation, key]
  );
  if (record.request_hash !== requestHash) bad(409, 'IDEMPOTENCY_KEY_REUSED', 'Khóa yêu cầu đã được sử dụng với nội dung khác');
  if (record.status === 'COMPLETED') return { replay: true, status: Number(record.response_status), body: typeof record.response_body === 'string' ? JSON.parse(record.response_body) : record.response_body };
  return { replay: false, id: record.id };
};
// [Backend] Lưu kết quả request để trả lại khi bị gửi trùng.
const finishRequest = async (conn, claim, status, message, data) => {
  const body = { success: true, message, data };
  await conn.execute(`UPDATE idempotency_requests SET status='COMPLETED',response_status=?,response_body=? WHERE id=?`,
    [status, JSON.stringify(body), claim.id]);
  return { status, body };
};
// [Backend] Ghi nhật ký thao tác vào bảng audit_logs.
const audit = async (conn, userId, action, entityType, entityId, detail = {}) => {
  await conn.execute(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail)
    VALUES (?,?,?,?,?)`, [userId, action, entityType, entityId, JSON.stringify(detail)]);
};
// [Backend] Gửi response đã lưu.
const sendTransaction = (res, value) => res.status(value.status).json(value.body);
module.exports = { pool, success, fail, BusinessError, bad, posId, qty, intMoney, money, trimmed, validation, replyError,
  withTx, hashPayload, claimRequest, finishRequest, audit, sendTransaction };
