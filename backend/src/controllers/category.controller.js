const pool = require('../config/db.config');
const { success, serverError } = require('../utils/response');

// [Giao diện] Trang chủ / Trang Sách: đổ danh sách thể loại vào bộ lọc.
const getCategories = async (req, res) => {
  try {
    const [items] = await pool.query(
      "SELECT id, name FROM categories WHERE status = 'active' ORDER BY name ASC"
    );
    return success(res, 200, 'Lấy danh mục sách thành công', { items });
  } catch (error) {
    return serverError(res, 'Lấy danh mục sách', error);
  }
};

module.exports = { getCategories };
