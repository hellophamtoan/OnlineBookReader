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
test('Đọc chương 11: không có gói -> 403 SUBSCRIPTION_REQUIRED', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]])
    .mockResolvedValueOnce([[{ id: 11, chapterNumber: 11, title: 'C11', content: '<p>paid</p>' }]])
    .mockResolvedValueOnce([[]]);
  const r = await call('GET', '/books/3/chapters/11', { auth: token(5) });
  expect(r.status).toBe(403);
  expect(r.json.code).toBe('SUBSCRIPTION_REQUIRED');
  expect(JSON.stringify(r.json)).not.toContain('paid');
});
test('Đọc chương 1: USER không có gói vẫn được đọc', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]])
    .mockResolvedValueOnce([[{ id: 1, chapterNumber: 1, title: 'C1', content: '<p>free</p>' }]]);
  const r = await call('GET', '/books/3/chapters/1', { auth: token(5) });
  expect(r.status).toBe(200);
  expect(r.json.data.content).toContain('free');
});
test('Mục lục: hiện khóa chương > 10 khi chưa có gói', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]])
    .mockResolvedValueOnce([[{ id: 1, chapterNumber: 1, title: 'C1' }, { id: 11, chapterNumber: 11, title: 'C11' }]])
    .mockResolvedValueOnce([[]]);
  const r = await call('GET', '/books/3/chapters', { auth: token(5) });
  expect(r.status).toBe(200);
  expect(r.json.data.freeChapterLimit).toBe(10);
  expect(r.json.data.items[0].locked).toBe(false);
  expect(r.json.data.items[1].locked).toBe(true);
});
test('Tiến trình: không gói vẫn được lấy, USER có JWT', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]]).mockResolvedValueOnce([[]]);
  const r = await call('GET', '/reading/progress/3', { auth: token(5) });
  expect(r.status).toBe(200);
});
test('Thư viện: ADMIN bị từ chối', async () => {
  asUser('ADMIN');
  expect((await call('GET', '/library', { auth: token(5) })).status).toBe(403);
});
test('Thư viện: cần JWT', async () => {
  expect((await call('GET', '/library')).status).toBe(401);
});
test('Đọc chương: không token -> 401', async () => {
  expect((await call('GET', '/books/3/chapters/1')).status).toBe(401);
});
test('Đọc chương > 10: có gói -> 200', async () => {
  asUser('USER');
  pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]])
    .mockResolvedValueOnce([[{ id: 19, chapterNumber: 11, title: 'C11', content: '<p>a</p>', prevChapterNumber: 10, nextChapterNumber: 12 }]])
    .mockResolvedValueOnce([[{ id: 1 }]]);
  const r = await call('GET', '/books/3/chapters/11', { auth: token(5) });
  expect(r.status).toBe(200);
  expect(r.json.data.nextChapterNumber).toBe(12);
});
test('Route sách công khai cũ vẫn chạy, không cần token', async () => {
  pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
  expect((await call('GET', '/books')).status).toBe(200);
});
test('Hồ sơ: PUT /users/me cần đăng nhập', async () => {
  expect((await call('PUT', '/users/me', { body: { fullName: 'A', email: 'a@x.com' } })).status).toBe(401);
});
