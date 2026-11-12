const pool = require('../config/db.config');
const { success, serverError } = require('../utils/response');

// Lấy danh sách nhà xuất bản đang hoạt động (dùng cho bộ lọc trang Sách)
const getPublishers = async (req, res) => {
  try {
    const [items] = await pool.query(
      "SELECT id, name FROM publishers WHERE status = 'active' ORDER BY name ASC"
    );
    return success(res, 200, 'Lấy danh sách nhà xuất bản thành công', { items });
  } catch (error) {
    return serverError(res, 'Lấy danh sách nhà xuất bản', error);
  }
};

module.exports = { getPublishers };
