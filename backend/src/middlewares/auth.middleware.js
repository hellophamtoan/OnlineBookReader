// middlewares/auth.middleware.js
// Kiem tra JWT trong header Authorization: Bearer <token>.
// Gan req.user de cac controller phia sau dung lai.

const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 'Thieu token xac thuc');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, ... }
    next();
  } catch (error) {
    return fail(res, 401, 'Token khong hop le hoac da het han');
  }
};

// Vi du dung cho phan quyen sau nay: requireRole('ADMIN')
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return fail(res, 403, 'Ban khong co quyen truy cap chuc nang nay');
  }
  next();
};

module.exports = { verifyToken, requireRole };
