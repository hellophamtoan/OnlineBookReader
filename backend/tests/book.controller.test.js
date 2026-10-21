// Unit Test UC003 - Sách: danh sách, tìm kiếm, lọc, phân trang, chi tiết.
// Mock MySQL, không kết nối database thật.
jest.mock('../src/config/db.config', () => ({ query: jest.fn() }));

const pool = require('../src/config/db.config');
const { getBooks, getBookById } = require('../src/controllers/book.controller');

const resMock = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const expectResponse = (res, code, message) => {
  expect(res.status).toHaveBeenCalledWith(code);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: code < 400, message }));
};
const getData = res => res.json.mock.calls[0][0].data;

beforeEach(() => jest.clearAllMocks());

describe('UC003 - GET /api/books', () => {
  test('Lấy danh sách sách thành công, có tác giả và thể loại', async () => {
    pool.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ id: 14, title: 'Những cuộc phiêu lưu của Sherlock Holmes', coverUrl: null }]])
      .mockResolvedValueOnce([[{ bookId: 14, name: 'Arthur Conan Doyle' }]])
      .mockResolvedValueOnce([[{ bookId: 14, name: 'Trinh thám' }]]);
    const res = resMock();
    await getBooks({ query: {} }, res);
    expectResponse(res, 200, 'Lấy danh sách sách thành công');
    expect(getData(res)).toEqual({
      items: [{ id: 14, title: 'Những cuộc phiêu lưu của Sherlock Holmes', coverUrl: null,
        authorNames: ['Arthur Conan Doyle'], categoryNames: ['Trinh thám'] }],
      page: 1, limit: 12, total: 1
    });
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test('Danh sách rỗng không truy vấn bảng tác giả và thể loại', async () => {
    pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getBooks({ query: {} }, res);
    expectResponse(res, 200, 'Lấy danh sách sách thành công');
    expect(getData(res)).toEqual({ items: [], page: 1, limit: 12, total: 0 });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('Tìm kiếm theo tên sách hoặc tên tác giả', async () => {
    pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getBooks({ query: { search: ' Sherlock ' } }, res);
    expectResponse(res, 200, 'Lấy danh sách sách thành công');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('b.title LIKE ?');
    expect(sql).toContain('a2.name LIKE ?');
    expect(params).toEqual(['%Sherlock%', '%Sherlock%']);
  });

  test('Lọc theo categoryId chỉ lấy sách có thể loại đang hoạt động', async () => {
    pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getBooks({ query: { categoryId: '3' } }, res);
    expectResponse(res, 200, 'Lấy danh sách sách thành công');
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('bc2.category_id = ?');
    expect(sql).toContain("c2.status = 'active'");
    expect(params).toEqual([3]);
  });

  test('Kết hợp tìm kiếm, lọc thể loại và phân trang', async () => {
    pool.query.mockResolvedValueOnce([[{ total: 19 }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getBooks({ query: { search: 'Dế', categoryId: '2', page: '2', limit: '5' } }, res);
    expectResponse(res, 200, 'Lấy danh sách sách thành công');
    expect(pool.query.mock.calls[0][1]).toEqual(['%Dế%', '%Dế%', 2]);
    expect(pool.query.mock.calls[1][1]).toEqual(['%Dế%', '%Dế%', 2, 5, 5]);
    expect(getData(res)).toEqual({ items: [], page: 2, limit: 5, total: 19 });
  });

  test.each([
    ['newest', 'b.created_at DESC, b.id DESC'],
    ['title_asc', 'b.title ASC, b.id ASC'],
    ['title_desc', 'b.title DESC, b.id DESC']
  ])('Sắp xếp %s', async (sort, orderSql) => {
    pool.query.mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([[]]);
    const res = resMock();
    await getBooks({ query: { sort } }, res);
    expectResponse(res, 200, 'Lấy danh sách sách thành công');
    expect(pool.query.mock.calls[1][0]).toContain(`ORDER BY ${orderSql}`);
  });

  test.each([
    [{ page: '0' }], [{ page: '-1' }], [{ page: 'abc' }],
    [{ limit: '0' }], [{ limit: '101' }], [{ limit: '1.5' }],
    [{ categoryId: '0' }], [{ categoryId: 'abc' }],
    [{ sort: 'invalid' }], [{ search: ['abc'] }]
  ])('Tham số không hợp lệ: %j', async query => {
    const res = resMock();
    await getBooks({ query }, res);
    expectResponse(res, 400, 'Tham số tìm kiếm, lọc hoặc phân trang không hợp lệ');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('Phân trang tạo offset vượt giới hạn số nguyên an toàn', async () => {
    const res = resMock();
    await getBooks({ query: { page: String(Number.MAX_SAFE_INTEGER), limit: '100' } }, res);
    expectResponse(res, 400, 'Trang yêu cầu không hợp lệ');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('Lỗi database trả HTTP 500', async () => {
    pool.query.mockRejectedValueOnce(new Error('Database unavailable'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = resMock();
      await getBooks({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    } finally { spy.mockRestore(); }
  });
});

describe('UC003 - GET /api/books/:id', () => {
  test('Xem chi tiết sách thành công', async () => {
    const book = { id: 14, title: 'Sherlock Holmes', description: 'Truyện trinh thám', coverUrl: null };
    const authors = [{ id: 3, name: 'Arthur Conan Doyle' }];
    const categories = [{ id: 3, name: 'Trinh thám' }];
    pool.query.mockResolvedValueOnce([[book]]).mockResolvedValueOnce([authors]).mockResolvedValueOnce([categories]);
    const res = resMock();
    await getBookById({ params: { id: '14' } }, res);
    expectResponse(res, 200, 'Lấy chi tiết sách thành công');
    expect(getData(res)).toEqual({ ...book, authors, categories });
    expect(pool.query.mock.calls.map(call => call[1])).toEqual([[14], [14], [14]]);
  });

  test.each(['0', '-1', 'abc', '1.5'])('Mã sách không hợp lệ: %s', async id => {
    const res = resMock();
    await getBookById({ params: { id } }, res);
    expectResponse(res, 400, 'Mã sách không hợp lệ');
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('Sách không tồn tại hoặc đã ẩn trả 404', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = resMock();
    await getBookById({ params: { id: '999' } }, res);
    expectResponse(res, 404, 'Không tìm thấy sách');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('Lỗi database trả HTTP 500', async () => {
    pool.query.mockRejectedValueOnce(new Error('Database unavailable'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = resMock();
      await getBookById({ params: { id: '14' } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    } finally { spy.mockRestore(); }
  });
});
