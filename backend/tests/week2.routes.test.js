// Kiểm tra phân quyền ở mức route (JWT + role + gói đọc) bằng server Express thật, MySQL được mock.
jest.mock('../src/config/db.config', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));
process.env.JWT_SECRET = 'test-secret';

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db.config');
const routes = require('../src/routes');

let server; let base;
const token = (id) => jwt.sign({ id }, 'test-secret', { algorithm: 'HS256' });
const call = async (method, path, { auth, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: await res.json() };
};
// verifyToken hỏi DB trạng thái user
const asUser = (role, active = 1) => pool.execute.mockResolvedValueOnce([[{ id: 5, email: 'a@x.com', role, is_active: active }]]);

beforeAll((done) => {
  const app = express();
  app.use(express.json());
  app.use('/api', routes);
  server = http.createServer(app).listen(0, () => { base = `http://127.0.0.1:${server.address().port}/api`; done(); });
});
afterAll((done) => { server.closeAllConnections(); server.close(done); });
beforeEach(() => { jest.resetAllMocks(); });

test('Admin API: không token -> 401', async () => {
  expect((await call('GET', '/admin/books')).status).toBe(401);
});
test('Admin API: USER -> 403', async () => {
  asUser('USER');
  expect((await call('GET', '/admin/categories', { auth: token(5) })).status).toBe(403);
});
test('Admin API: tài khoản bị khóa -> 403 (token cũ vô hiệu)', async () => {
  asUser('ADMIN', 0);
  expect((await call('GET', '/admin/books', { auth: token(5) })).status).toBe(403);
});
test('Admin API: ADMIN gọi được', async () => {
  asUser('ADMIN');
  pool.query.mockResolvedValueOnce([[{ id: 1, name: 'Thiếu nhi', status: 'active' }]]);
  const r = await call('GET', '/admin/categories', { auth: token(5) });
  expect(r.status).toBe(200);
  expect(r.json.data.items).toHaveLength(1);
});
test('Đọc chương: không có gói -> 403 và KHÔNG truy vấn nội dung', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[]]); // subscriptions rỗng
  const r = await call('GET', '/books/3/chapters/1', { auth: token(5) });
  expect(r.status).toBe(403);
  expect(pool.execute).toHaveBeenCalledTimes(2); // chỉ verifyToken + kiểm tra gói
});
test('Đọc chương: không token -> 401', async () => {
  expect((await call('GET', '/books/3/chapters/1')).status).toBe(401);
});
test('Đọc chương: có gói -> 200', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[{ id: 1 }]])
    .mockResolvedValueOnce([[{ id: 3, title: 'A' }]])
    .mockResolvedValueOnce([[{ id: 9, chapterNumber: 1, title: 'C1', content: '<p>a</p>', prevChapterNumber: null, nextChapterNumber: 2 }]]);
  const r = await call('GET', '/books/3/chapters/1', { auth: token(5) });
  expect(r.status).toBe(200);
  expect(r.json.data.nextChapterNumber).toBe(2);
});
test('Route sách công khai cũ vẫn chạy, không cần token', async () => {
  pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
  expect((await call('GET', '/books')).status).toBe(200);
});
test('Hồ sơ: PUT /users/me cần đăng nhập', async () => {
  expect((await call('PUT', '/users/me', { body: { fullName: 'A', email: 'a@x.com' } })).status).toBe(401);
});
