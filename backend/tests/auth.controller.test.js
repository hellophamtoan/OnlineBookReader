// Unit test UC002 - mock DB, bcrypt, JWT; khong ket noi Railway.
process.env.JWT_SECRET = 'test-secret-not-for-production';
process.env.JWT_EXPIRES_IN = '1d';

jest.mock('../src/config/db.config', () => ({ execute: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn() }));

const pool = require('../src/config/db.config');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { login, me, logout } = require('../src/controllers/auth.controller');
const { verifyToken } = require('../src/middlewares/auth.middleware');

const user = { id: 1, full_name: 'Nguyen Van A', email: 'user1@gmail.com', password_hash: 'hashed', role: 'USER', is_active: 1, avatar_url: null };
const resMock = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const expectResponse = (res, code, message) => {
  expect(res.status).toHaveBeenCalledWith(code);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: code < 400, message }));
};

beforeEach(() => { jest.clearAllMocks(); });

describe('UC002 - POST /api/auth/login', () => {
  test('Dang nhap thanh cong, tra JWT va thong tin user', async () => {
    pool.execute.mockResolvedValue([[user]]);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('test.jwt.token');
    const res = resMock();
    await login({ body: { email: ' USER1@GMAIL.COM ', password: '12345678' } }, res);
    expectResponse(res, 200, 'Đăng nhập thành công');
    expect(pool.execute).toHaveBeenCalledWith(expect.any(String), ['user1@gmail.com']);
    expect(bcrypt.compare).toHaveBeenCalledWith('12345678', 'hashed');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: {
      token: 'test.jwt.token', user: { id: 1, fullName: 'Nguyen Van A', email: 'user1@gmail.com', role: 'USER' }
    } }));
  });
  test('Thieu email hoac mat khau', async () => {
    const res = resMock();
    await login({ body: { email: '' } }, res);
    expectResponse(res, 400, 'Vui lòng nhập email và mật khẩu');
    expect(pool.execute).not.toHaveBeenCalled();
  });
  test('Email sai dinh dang', async () => {
    const res = resMock();
    await login({ body: { email: 'abc', password: '12345678' } }, res);
    expectResponse(res, 400, 'Email không hợp lệ');
  });
  test('Email khong ton tai', async () => {
    pool.execute.mockResolvedValue([[]]);
    const res = resMock();
    await login({ body: { email: 'none@gmail.com', password: '12345678' } }, res);
    expectResponse(res, 401, 'Email hoặc mật khẩu không chính xác');
  });
  test('Sai mat khau', async () => {
    pool.execute.mockResolvedValue([[user]]);
    bcrypt.compare.mockResolvedValue(false);
    const res = resMock();
    await login({ body: { email: user.email, password: 'wrong' } }, res);
    expectResponse(res, 401, 'Email hoặc mật khẩu không chính xác');
  });
  test('Tai khoan bi khoa', async () => {
    pool.execute.mockResolvedValue([[{ ...user, is_active: 0 }]]);
    bcrypt.compare.mockResolvedValue(true);
    const res = resMock();
    await login({ body: { email: user.email, password: '12345678' } }, res);
    expectResponse(res, 403, 'Tài khoản đã bị khóa');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  test('Loi database tra 500', async () => {
    pool.execute.mockRejectedValue(new Error('Database unavailable'));
    const res = resMock();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await login({ body: { email: user.email, password: '12345678' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    spy.mockRestore();
  });
});

describe('UC002 - GET /api/auth/me', () => {
  test('Tra thong tin user, khong lo password_hash', async () => {
    pool.execute.mockResolvedValue([[user]]);
    const res = resMock();
    await me({ user: { id: 1 } }, res);
    expectResponse(res, 200, 'Lấy thông tin tài khoản thành công');
    const data = res.json.mock.calls[0][0].data;
    expect(data).toEqual({ id: 1, fullName: 'Nguyen Van A', email: user.email, role: 'USER', avatarUrl: null });
    expect(data.password_hash).toBeUndefined();
  });
  test('Khong tim thay user', async () => {
    pool.execute.mockResolvedValue([[]]);
    const res = resMock();
    await me({ user: { id: 99 } }, res);
    expectResponse(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  });
});

describe('UC002 - middleware verifyToken', () => {
  test('Thieu bearer token tra 401', async () => {
    const res = resMock();
    await verifyToken({ headers: {} }, res, jest.fn());
    expectResponse(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  });
  test('Token hop le cho qua middleware', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    pool.execute.mockResolvedValue([[user]]);
    const req = { headers: { authorization: 'Bearer valid.token' } };
    const res = resMock();
    const next = jest.fn();
    await verifyToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: 1, email: user.email, role: 'USER' });
  });
  test('Token het han tra 401', async () => {
    const err = new Error('expired'); err.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => { throw err; });
    const res = resMock();
    await verifyToken({ headers: { authorization: 'Bearer expired.token' } }, res, jest.fn());
    expectResponse(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  });
});

describe('UC002 - POST /api/auth/logout', () => {
  test('Tra 200; frontend phai xoa token', () => {
    const res = resMock();
    logout({}, res);
    expectResponse(res, 200, 'Đăng xuất thành công');
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Đăng xuất thành công', data: null });
  });
});
