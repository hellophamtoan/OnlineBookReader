jest.mock('../src/config/db.config', () => ({ execute: jest.fn(), getConnection: jest.fn() }));
const pool = require('../src/config/db.config');
const svc = require('../src/services/wallet.service');

const makeConn = (script) => {
  const conn = {
    execute: jest.fn(async (sql) => { for (const [re, out] of script) if (re.test(sql)) return typeof out === 'function' ? out() : out; throw new Error('Chưa mock: ' + sql); }),
    beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
  };
  pool.getConnection.mockResolvedValue(conn);
  return conn;
};

describe('Nạp ví QR', () => {
  test('validate số tiền và phương thức', () => {
    expect(svc.validateTopupBody({ amount: 100000 })).toEqual({ amount: 100000, note: null });
    expect(() => svc.validateTopupBody({ amount: 5000 })).toThrow();
    expect(() => svc.validateTopupBody({ amount: '100000' })).toThrow();
    expect(() => svc.validateTopupBody({ amount: 100000.5 })).toThrow();
    expect(() => svc.validateTopupBody({ amount: 50000001 })).toThrow();
    expect(() => svc.validateTopupBody({ amount: 100000, method: 'MOMO' })).toThrow();
  });
  test('mã yêu cầu chỉ chữ + số, <= 25 ký tự', () => {
    const c = svc.buildOrderCode(1234567);
    expect(c).toMatch(/^[A-Z0-9]{1,25}$/);
  });
  test('link QR VietQR', () => {
    const url = svc.buildQrUrl({ bin: '970422', accountNo: '0989807884', accountName: 'NGUYEN VAN HA' }, 100000, 'NAP1ABC');
    expect(url).toContain('970422-0989807884-print.jpg');
    expect(url).toContain('amount=100000');
    expect(url).toContain('addInfo=NAP1ABC');
  });
  test('validate tài khoản ngân hàng', () => {
    expect(svc.validateBankBody({ bin: '970422', accountNo: '0989 807 884', accountName: 'nguyen van ha', bankName: 'MB Bank' }).accountNo).toBe('0989807884');
    expect(() => svc.validateBankBody({ bin: '12', accountNo: '0989807884', accountName: 'ABC' })).toThrow();
  });
  test('confirm: cộng ví + ghi giao dịch + đổi trạng thái trong 1 transaction', async () => {
    const conn = makeConn([
      [/FROM wallet_topup_requests/, [[{ id: 9, user_id: 3, amount: '100000.00', status: 'PENDING', paid_at: null }]]],
      [/SELECT id, role, wallet_balance/, [[{ id: 3, role: 'USER', wallet_balance: '50000.00' }]]],
      [/UPDATE users SET wallet_balance/, [{}]],
      [/SELECT wallet_balance FROM users/, [[{ wallet_balance: '150000.00' }]]],
      [/INSERT INTO wallet_transactions/, [{ insertId: 77 }]],
      [/UPDATE wallet_topup_requests/, [{}]],
      [/INSERT INTO audit_logs/, [{}]],
    ]);
    const r = await svc.confirmTopup(1, 3, 'NAPX');
    expect(r).toMatchObject({ already: false, amount: 100000, balance: 150000, status: 'PAID' });
    expect(conn.commit).toHaveBeenCalled();
  });
  test('confirm lần 2: không cộng thêm', async () => {
    const conn = makeConn([
      [/FROM wallet_topup_requests/, [[{ id: 9, user_id: 3, amount: '100000.00', status: 'PAID', paid_at: new Date() }]]],
      [/SELECT id, role, wallet_balance/, [[{ id: 3, role: 'USER', wallet_balance: '150000.00' }]]],
    ]);
    const r = await svc.confirmTopup(1, 3, 'NAPX');
    expect(r.already).toBe(true);
    expect(conn.execute.mock.calls.some(([s]) => /UPDATE users/.test(s))).toBe(false);
  });
  test('confirm yêu cầu đã hủy -> 400, rollback', async () => {
    const conn = makeConn([
      [/FROM wallet_topup_requests/, [[{ id: 9, user_id: 3, amount: '100000.00', status: 'CANCELLED', paid_at: null }]]],
      [/SELECT id, role, wallet_balance/, [[{ id: 3, role: 'USER', wallet_balance: '0' }]]],
    ]);
    await expect(svc.confirmTopup(1, 3, 'NAPX')).rejects.toMatchObject({ status: 400 });
    expect(conn.rollback).toHaveBeenCalled();
  });
  test('confirm không tìm thấy -> 404', async () => {
    makeConn([[/FROM wallet_topup_requests/, [[]]]]);
    await expect(svc.confirmTopup(1, 3, 'X')).rejects.toMatchObject({ status: 404 });
  });
});
