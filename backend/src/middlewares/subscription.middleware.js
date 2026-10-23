const pool = require('../config/db.config');
const { fail, serverError } = require('../utils/response');

// Quy tắc 8: quyền đọc e-book = có subscription với start_date <= now <= end_date.
// Dùng sau verifyToken.
const requireReadAccess = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM subscriptions WHERE user_id = ? AND start_date <= NOW() AND end_date >= NOW() LIMIT 1',
      [req.user.id]
    );
    if (!rows.length) {
      return fail(res, 403, 'Bạn cần đăng ký gói đọc còn hiệu lực để đọc sách');
    }
    return next();
  } catch (error) {
    return serverError(res, 'Kiểm tra quyền đọc', error);
  }
};

module.exports = { requireReadAccess };
