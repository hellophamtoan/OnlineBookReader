// Unit Test UC003 - Danh mục sách; mock MySQL, không kết nối database thật.
jest.mock('../src/config/db.config', () => ({ query: jest.fn() }));

const pool = require('../src/config/db.config');
const { getCategories } = require('../src/controllers/category.controller');
const resMock = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

beforeEach(() => jest.clearAllMocks());

describe('UC003 - GET /api/categories', () => {
  test('Lấy danh mục đang hoạt động thành công', async () => {
    const items = [{ id: 3, name: 'Trinh thám' }, { id: 1, name: 'Văn học Việt Nam' }];
    pool.query.mockResolvedValueOnce([items]);
    const res = resMock();
    await getCategories({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true, message: 'Lấy danh mục sách thành công', data: { items }
    });
    expect(pool.query).toHaveBeenCalledWith(
      "SELECT id, name FROM categories WHERE status = 'active' ORDER BY name ASC"
    );
  });

  test('Không có danh mục vẫn trả danh sách rỗng', async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = resMock();
    await getCategories({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true, message: 'Lấy danh mục sách thành công', data: { items: [] }
    });
  });

  test('Lỗi database trả HTTP 500', async () => {
    pool.query.mockRejectedValueOnce(new Error('Database unavailable'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = resMock();
      await getCategories({}, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    } finally { spy.mockRestore(); }
  });
});
