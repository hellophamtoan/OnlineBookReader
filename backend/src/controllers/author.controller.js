const pool = require('../config/db.config');
const { success, serverError } = require('../utils/response');

// Lấy danh sách tác giả đang hoạt động (dùng cho bộ lọc trang Sách)
const getAuthors = async (req, res) => {
  try {
    const [items] = await pool.query(
      "SELECT id, name FROM authors WHERE status = 'active' ORDER BY name ASC"
    );
    return success(res, 200, 'Lấy danh sách tác giả thành công', { items });
  } catch (error) {
    return serverError(res, 'Lấy danh sách tác giả', error);
  }
};

module.exports = { getAuthors };
