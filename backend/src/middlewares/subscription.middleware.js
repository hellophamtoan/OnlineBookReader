const pool = require('../config/db.config');
const { fail, serverError } = require('../utils/response');

// Kiểm tra gói đọc còn hạn; dùng sau verifyToken.
// Chỉ chặn khi xem chương trả phí (chapterNumber > 10).
const FREE_CHAPTER_LIMIT = 10;

const hasActiveSubscription = async (userId) => {
  const [rows] = await pool.execute(
    'SELECT id FROM subscriptions WHERE user_id = ? AND start_date <= NOW() AND end_date > NOW() LIMIT 1',
    [userId]
  );
  return rows.length > 0;
};

const requireReadAccess = async (req, res, next) => {
  try {
    if (!await hasActiveSubscription(req.user.id)) {
      return fail(res, 403, 'Bạn cần đăng ký gói đọc còn hiệu lực để đọc sách');
    }
    return next();
  } catch (error) {
    return serverError(res, 'Kiểm tra quyền đọc', error);
  }
};

module.exports = { requireReadAccess, hasActiveSubscription, FREE_CHAPTER_LIMIT };
