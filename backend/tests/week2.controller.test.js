// Unit test tuần 2: UC006 (đọc sách), UC007 (quản lý danh mục & kho sách), UC012 (hồ sơ). Mock MySQL.
const mockConn = { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(), execute: jest.fn(), query: jest.fn() };
jest.mock('../src/config/db.config', () => ({ query: jest.fn(), execute: jest.fn(), getConnection: jest.fn() }));

const pool = require('../src/config/db.config');
const { requireReadAccess } = require('../src/middlewares/subscription.middleware');
const { listChapters, getChapter } = require('../src/controllers/chapter.controller');
const { getProgress, saveProgress } = require('../src/controllers/reading.controller');
const { getProfile, updateProfile } = require('../src/controllers/profile.controller');
const { categoryController, authorController } = require('../src/controllers/admin.catalog.controller');
const book = require('../src/controllers/admin.book.controller');
const chapter = require('../src/controllers/admin.chapter.controller');

const resMock = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const user = { id: 5, role: 'USER' };
beforeEach(() => {
  jest.resetAllMocks();
  pool.getConnection.mockResolvedValue(mockConn);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('UC006 - quyền đọc', () => {
  test('Không có gói còn hạn -> 403', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = resMock(); const next = jest.fn();
    await requireReadAccess({ user }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(pool.execute.mock.calls[0][0]).toContain('start_date <= NOW() AND end_date >= NOW()');
  });
  test('Có gói còn hạn -> next()', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
    const next = jest.fn();
    await requireReadAccess({ user }, resMock(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('UC006 - chương', () => {
  test('Mục lục: sách không có e-book -> 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = resMock();
    await listChapters({ params: { id: '3' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  test('Mã sách sai -> 400', async () => {
    const res = resMock();
    await listChapters({ params: { id: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('Lấy một chương thành công, có chương trước/sau', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'Mắt biếc' }]])
      .mockResolvedValueOnce([[{ id: 9, chapterNumber: 2, title: 'C2', content: '<p>x</p>', prevChapterNumber: 1, nextChapterNumber: 3 }]]);
    const res = resMock();
    await getChapter({ params: { id: '3', chapterNumber: '2' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toMatchObject({ bookId: 3, chapterNumber: 2, prevChapterNumber: 1, nextChapterNumber: 3 });
  });
  test('Chương không tồn tại -> 404', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getChapter({ params: { id: '3', chapterNumber: '99' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('UC006 - tiến trình đọc', () => {
  test('Chưa có tiến trình -> mặc định', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 3, title: 'A' }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getProgress({ user, params: { bookId: '3' } }, res);
    expect(res.json.mock.calls[0][0].data).toMatchObject({ chapterNumber: null, scrollPercent: 0, fontFamily: 'Arial', fontSize: 16 });
  });
  test.each([
    [{ chapterNumber: 0 }], [{ chapterNumber: 1, scrollPercent: 101 }], [{ chapterNumber: 1, fontSize: 5 }],
    [{ chapterNumber: 1, fontSize: '16' }], [{ chapterNumber: 1, fontFamily: '<script>' }], [{ chapterNumber: 1, scrollPercent: true }]
  ])('Body sai %j -> 400', async (body) => {
    const res = resMock();
    await saveProgress({ user, params: { bookId: '3' }, body }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.execute).not.toHaveBeenCalled();
  });
  test('Lưu lần đầu -> INSERT với font mặc định', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 3, title: 'A' }]]) // sách
      .mockResolvedValueOnce([[{ id: 9 }]])             // chương
      .mockResolvedValueOnce([[]])                      // chưa có tiến trình
      .mockResolvedValueOnce([{}])                      // insert
      .mockResolvedValueOnce([[{ chapterId: 9, scrollPercent: '42.50', fontFamily: 'Arial', fontSize: 16 }]]);
    const res = resMock();
    await saveProgress({ user, params: { bookId: '3' }, body: { chapterNumber: 2, scrollPercent: 42.5 } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(pool.execute.mock.calls[3][0]).toContain('INSERT INTO reading_progress');
    expect(pool.execute.mock.calls[3][1]).toEqual([5, 3, 9, 42.5, 'Arial', 16]);
    expect(res.json.mock.calls[0][0].data.scrollPercent).toBe(42.5);
  });
  test('Lưu lần sau -> UPDATE, không gửi font thì giữ nguyên (COALESCE)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 3, title: 'A' }]]).mockResolvedValueOnce([[{ id: 9 }]])
      .mockResolvedValueOnce([[{ id: 77 }]]).mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ chapterId: 9, scrollPercent: '10.00', fontFamily: 'Georgia', fontSize: 20 }]]);
    const res = resMock();
    await saveProgress({ user, params: { bookId: '3' }, body: { chapterNumber: 2, scrollPercent: 10 } }, res);
    expect(pool.execute.mock.calls[3][0]).toContain('COALESCE(?, font_family)');
    expect(pool.execute.mock.calls[3][1]).toEqual([9, 10, null, null, 77]);
  });
});

describe('UC012 - hồ sơ', () => {
  const row = { id: 5, full_name: 'A', email: 'a@x.com', phone: null, avatar_url: null, role: 'USER', wallet_balance: '0.00', created_at: 'x' };
  test('Xem hồ sơ không lộ password_hash', async () => {
    pool.execute.mockResolvedValueOnce([[row]]);
    const res = resMock();
    await getProfile({ user }, res);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('password');
    expect(pool.execute.mock.calls[0][0]).not.toContain('password_hash');
  });
  test.each([
    [{ fullName: '', email: 'a@x.com' }, 400], [{ fullName: 'A', email: 'sai' }, 400],
    [{ fullName: 'A', email: 'a@x.com', phone: '12ab' }, 400], [{ fullName: 'A', email: 'a@x.com', avatarUrl: 'javascript:alert(1)' }, 400]
  ])('Body sai %j -> %i', async (body, code) => {
    const res = resMock();
    await updateProfile({ user, body }, res);
    expect(res.status).toHaveBeenCalledWith(code);
  });
  test('Email trùng người khác -> 409', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 9 }]]);
    const res = resMock();
    await updateProfile({ user, body: { fullName: 'A', email: 'B@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(pool.execute.mock.calls[0][1]).toEqual(['b@x.com', 5]);
  });
  test('Cập nhật thành công', async () => {
    pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{}]).mockResolvedValueOnce([[{ ...row, phone: '0912345678' }]]);
    const res = resMock();
    await updateProfile({ user, body: { fullName: ' Toản ', email: 'a@x.com', phone: '0912 345 678', avatarUrl: '' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(pool.execute.mock.calls[1][1]).toEqual(['Toản', 'a@x.com', '0912 345 678', null, 5]);
  });
});

describe('UC007 - danh mục (thể loại/tác giả/NXB)', () => {
  test('Thêm thể loại trùng tên -> 409', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
    const res = resMock();
    await categoryController.create({ body: { name: 'Thiếu nhi' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  test('Thiếu tên -> 400', async () => {
    const res = resMock();
    await authorController.create({ body: { name: '  ' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('Thêm tác giả thành công -> 201', async () => {
    pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 11 }]).mockResolvedValueOnce([[{ id: 11, name: 'X', bio: null, status: 'active' }]]);
    const res = resMock();
    await authorController.create({ body: { name: 'X' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
  test('Xóa = xóa mềm (UPDATE status), không DELETE', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 2, name: 'N', status: 'active' }]]).mockResolvedValueOnce([{}]);
    const res = resMock();
    await categoryController.remove({ params: { id: '2' } }, res);
    expect(pool.execute.mock.calls[1][0]).toBe("UPDATE categories SET status = 'inactive' WHERE id = ?");
    expect(res.status).toHaveBeenCalledWith(200);
  });
  test('Xóa mục không tồn tại -> 404', async () => {
    pool.execute.mockResolvedValueOnce([[]]);
    const res = resMock();
    await categoryController.remove({ params: { id: '99' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
  test('Lọc status sai -> 400', async () => {
    const res = resMock();
    await categoryController.list({ query: { status: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('UC007 - sách', () => {
  const ok = { title: 'S', hasPhysical: true, hasEbook: false, price: 50000, stock: 3, authorIds: [1], categoryIds: [2], publisherId: 1 };
  test.each([
    [{ ...ok, title: '' }], [{ ...ok, hasPhysical: false, hasEbook: false }], [{ ...ok, price: -1 }], [{ ...ok, price: undefined }],
    [{ ...ok, stock: -2 }], [{ ...ok, stock: 1.5 }], [{ ...ok, authorIds: [] }], [{ ...ok, categoryIds: ['x'] }],
    [{ ...ok, hasPhysical: 'true' }], [{ ...ok, coverUrl: 'javascript:x' }]
  ])('Body sai bị từ chối %j', (body) => {
    expect(book.parseBookBody(body, false).error).toBeTruthy();
  });
  test('Sách chỉ e-book: price = null, stock = 0 dù gửi gì', () => {
    const { value } = book.parseBookBody({ ...ok, hasPhysical: false, hasEbook: true, price: 99, stock: 9 }, false);
    expect(value).toMatchObject({ price: null, stock: 0 });
  });
  test('Thêm sách: tác giả không hợp lệ -> 400, không mở transaction', async () => {
    pool.query.mockResolvedValueOnce([[{ n: 0 }]]);
    const res = resMock();
    await book.createBook({ body: ok }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });
  test('Thêm sách thành công: transaction commit, ghi bảng nối', async () => {
    pool.query.mockResolvedValue([[{ n: 1 }]]);
    mockConn.execute.mockResolvedValueOnce([{ insertId: 21 }]).mockResolvedValue([{}]);
    mockConn.query.mockResolvedValue([{}]);
    pool.execute.mockResolvedValueOnce([[{ id: 21, title: 'S', hasPhysical: 1, hasEbook: 0, price: '50000.00', status: 'active' }]])
      .mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await book.createBook({ body: ok }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockConn.commit).toHaveBeenCalled();
    expect(mockConn.rollback).not.toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
    expect(mockConn.query.mock.calls[0][1]).toEqual([[[21, 1]]]);
    expect(res.json.mock.calls[0][0].data).toMatchObject({ hasPhysical: true, hasEbook: false, price: 50000 });
  });
  test('Lỗi giữa transaction -> rollback và 500', async () => {
    pool.query.mockResolvedValue([[{ n: 1 }]]);
    mockConn.execute.mockRejectedValueOnce(new Error('boom'));
    const res = resMock();
    await book.createBook({ body: ok }, res);
    expect(mockConn.rollback).toHaveBeenCalled();
    expect(mockConn.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
  test('Xóa sách = xóa mềm', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 4 }]]).mockResolvedValueOnce([{}]);
    const res = resMock();
    await book.deleteBook({ params: { id: '4' } }, res);
    expect(pool.execute.mock.calls[1][0]).toBe("UPDATE books SET status = 'inactive' WHERE id = ?");
  });
});

describe('UC007 - chương e-book', () => {
  test('Nội dung được làm sạch XSS khi lưu', () => {
    const { value } = chapter.parseChapterBody({ chapterNumber: 1, title: 'T', content: '<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)>' });
    expect(value.content).toBe('<p>Hi</p>');
  });
  test('Số chương trùng -> 409', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 3, has_ebook: 1 }]]).mockRejectedValueOnce(Object.assign(new Error('d'), { code: 'ER_DUP_ENTRY' }));
    const res = resMock();
    await chapter.createChapter({ params: { bookId: '3' }, body: { chapterNumber: 1, title: 'T', content: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  test('Sách không bật e-book -> 400', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 3, has_ebook: 0 }]]);
    const res = resMock();
    await chapter.createChapter({ params: { bookId: '3' }, body: { chapterNumber: 1, title: 'T', content: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('Xóa chương đang có tiến trình đọc -> 409', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 9 }]]).mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'ER_ROW_IS_REFERENCED_2' }));
    const res = resMock();
    await chapter.deleteChapter({ params: { id: '9' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
