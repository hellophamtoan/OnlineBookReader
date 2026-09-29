// middlewares/auth.middleware.js
// Kiểm tra JWT trong header Authorization: Bearer <token>.
// Sau khi giải mã, đọc lại user từ DB để:
//   - chặn tài khoản bị khóa dùng token cũ (UC010)
//   - lấy role mới nhất, không tin role trong token
// Gắn req.user = { id, email, role } cho các controller phía sau.

const jwt = require('jsonwebtoken');
const pool = require('../config/db.config');
const { fail, serverError } = require('../utils/response');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 'Thiếu token xác thực');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    // Chỉ chấp nhận HS256, tránh tấn công đổi thuật toán
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return fail(res, 401, 'Token không hợp lệ hoặc đã hết hạn');
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    const user = rows[0];

    if (!user) {
      return fail(res, 401, 'Tài khoản không tồn tại');
    }
    if (!user.is_active) {
      return fail(res, 403, 'Tài khoản đã bị khóa');
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    return serverError(res, 'verifyToken', error);
  }
};

// Ví dụ: router.get('/users', verifyToken, requireRole(ROLES.ADMIN), handler)
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return fail(res, 403, 'Bạn không có quyền truy cập chức năng này');
  }
  next();
};

module.exports = { verifyToken, requireRole };
