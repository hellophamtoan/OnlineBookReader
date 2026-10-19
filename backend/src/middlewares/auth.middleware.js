const jwt = require('jsonwebtoken');
const { fail, serverError } = require('../utils/response');
const pool = require('../config/db.config');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+\S+$/i.test(authHeader)) {
    return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
  }
  try {
    const token = authHeader.split(/\s+/)[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!decoded || !Number.isInteger(decoded.id)) {
      return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    const [rows] = await pool.execute('SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1', [decoded.id]);
    if (!rows.length) return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    if (!rows[0].is_active) return fail(res, 403, 'Tài khoản đã bị khóa');
    req.user = { id: rows[0].id, email: rows[0].email, role: rows[0].role };
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    return serverError(res, 'Xác thực tài khoản', error);
  }
};

const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return fail(res, 403, 'Bạn không có quyền truy cập chức năng này');
  }
  next();
};

module.exports = { verifyToken, requireRole };
