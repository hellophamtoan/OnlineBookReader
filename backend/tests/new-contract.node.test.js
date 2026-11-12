// Tests nhanh KHONG can npm install: node --test tests/new-contract.node.test.js
// Dùng Module._load mock chỉ trong tiến trình này; không gọi MySQL thật.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const path = require('node:path');
const mockPool = { execute: async () => { throw Error('No mock response'); }, query: async () => { throw Error('No mock response'); } };
const mockBcrypt = { compare: async (plain, hash) => plain === 'current123' && hash === 'oldhash', hash: async () => 'newhash' };
Module._load = function (request, parent, isMain) {
  if (request === '../config/db.config') return mockPool;
  if (request === 'bcrypt') return mockBcrypt;
  return originalLoad.apply(this, arguments);
};
const { listChapters, getChapter } = require('../src/controllers/chapter.controller');
const { getProgress } = require('../src/controllers/reading.controller');
const { updateProfile } = require('../src/controllers/profile.controller');
const library = require('../src/controllers/library.controller');
Module._load = originalLoad;
const res = () => ({ status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; } });
const req = (params = {}, body = {}) => ({ user: { id: 5, role: 'USER' }, params, body });
const sequence = (...returns) => {
  const calls = [];
  mockPool.execute = async (sql, args) => {
    calls.push([sql, args]);
    if (!returns.length) throw Error('Unexpected db call: ' + sql);
    return returns.shift();
  };
  return calls;
};

// Các test chạy tuần tự do cùng mock pool.
test('UC006 - mục lục có flag chương khóa/mở', async () => {
  sequence([[{ id: 24, title: 'Sách' }]], [[{ id: 1, chapterNumber: 1, title: 'free' }, { id: 11, chapterNumber: 11, title: 'paid' }]], [[]]);
  const response = res();
  await listChapters(req({ id: '24' }), response);
  assert.equal(response.code, 200);
  assert.equal(response.body.data.freeChapterLimit, 10);
  assert.equal(response.body.data.hasActiveSubscription, false);
  assert.deepEqual(response.body.data.items.map(x => [x.isFree, x.locked]), [[true, false], [false, true]]);
});
test('UC006 - chương 10 đọc miễn phí', async () => {
  const calls = sequence([[{ id: 24, title: 'Sách' }]], [[{ id: 10, chapterNumber: 10, title: 'ok', content: '<p>ok</p>' }]]);
  const response = res();
  await getChapter(req({ id: '24', chapterNumber: '10' }), response);
  assert.equal(response.code, 200);
  assert.equal(calls.length, 2);
});
test('UC006 - chương 11 bị khóa nếu hết gói, không rò nội dung', async () => {
  sequence([[{ id: 24, title: 'Sách' }]], [[{ id: 11, chapterNumber: 11, content: 'SECRET' }]], [[]]);
  const response = res();
  await getChapter(req({ id: '24', chapterNumber: '11' }), response);
  assert.equal(response.code, 403);
  assert.equal(response.body.code, 'SUBSCRIPTION_REQUIRED');
  assert.equal(JSON.stringify(response.body).includes('SECRET'), false);
});
test('UC006 - chương 11 có gói được đọc', async () => {
  sequence([[{ id: 24, title: 'Sách' }]], [[{ id: 11, chapterNumber: 11, content: 'SECRET' }]], [[{ id: 1 }]]);
  const response = res();
  await getChapter(req({ id: '24', chapterNumber: '11' }), response);
  assert.equal(response.code, 200);
});
test('UC006 - tiến trình không yêu cầu truy vấn gói đọc', async () => {
  const calls = sequence([[{ id: 24, title: 'Sách' }]], [[]]);
  const response = res();
  await getProgress(req({ bookId: '24' }), response);
  assert.equal(response.code, 200);
  assert.equal(calls.length, 2);
});
test('UC012 - đổi mật khẩu thành công', async () => {
  const calls = sequence([[{ password_hash: 'oldhash' }]], [[]], [{ affectedRows: 1 }], [[{ id: 5, full_name: 'Test', email: 'a@b.com', role: 'USER', wallet_balance: 0 }]]);
  const response = res();
  await updateProfile(req({}, { fullName: 'Test', email: 'a@b.com', currentPassword: 'current123', newPassword: 'newpassword', confirmNewPassword: 'newpassword' }), response);
  assert.equal(response.code, 200);
  assert.match(calls[2][0], /password_hash = \?/);
  assert.equal(calls[2][1][4], 'newhash');
  assert.equal('password_hash' in response.body.data, false);
});
test('UC012 - sai mật khẩu hiện tại không ghi dữ liệu', async () => {
  const calls = sequence([[{ password_hash: 'oldhash' }]]);
  const response = res();
  await updateProfile(req({}, { fullName: 'Test', email: 'a@b.com', currentPassword: 'wrong', newPassword: 'newpassword', confirmNewPassword: 'newpassword' }), response);
  assert.equal(response.code, 400);
  assert.equal(calls.length, 1);
});
test('UC012 - đường dẫn avatar /uploads được chấp nhận', async () => {
  sequence([[]], [{ affectedRows: 1 }], [[{ id: 5, full_name: 'Test', email: 'a@b.com', role: 'USER', wallet_balance: 0, avatar_url: '/uploads/avatar.jpg' }]]);
  const response = res();
  await updateProfile(req({}, { fullName: 'Test', email: 'a@b.com', avatarUrl: '/uploads/avatar.jpg' }), response);
  assert.equal(response.code, 200);
});
test('Library - thêm sách, xác nhận ID, xử lý người dùng', async () => {
  const calls = sequence([[{ id: 24 }]], [{ affectedRows: 1 }]);
  const response = res();
  await library.addBook(req({ bookId: '24' }), response);
  assert.equal(response.code, 200);
  assert.equal(response.body.data.inLibrary, true);
  assert.equal(calls[1][1][0], 5);
});
test('Library - danh sách rỗng không query bảng tác giả', async () => {
  const calls = sequence([[]]);
  const response = res();
  await library.listLibrary(req(), response);
  assert.equal(response.code, 200);
  assert.deepEqual(response.body.data.items, []);
  assert.equal(calls.length, 1);
});
