const pool = require('../config/db.config');
const { success, serverError } = require('../utils/response');

// [Giao diện] Trang Sách: đổ danh sách tác giả vào bộ lọc.
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
