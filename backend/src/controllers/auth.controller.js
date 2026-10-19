const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { normalizeEmail, isValidEmail, isValidPassword, isNonEmptyString, SALT_ROUNDS } = require('../utils/validators');

// UC001 - Đăng ký tài khoản (giữ nguyên logic đã chạy)
const register = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body || {};
    if (![fullName, email, password, confirmPassword].every(isNonEmptyString)) {
      return fail(res, 400, 'Vui lòng nhập đầy đủ thông tin');
    }
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = fullName.trim();
    if (normalizedName.length > 100) return fail(res, 400, 'Họ tên không được vượt quá 100 ký tự');
    if (!isValidEmail(normalizedEmail) || normalizedEmail.length > 255) return fail(res, 400, 'Email không hợp lệ');
    if (!isValidPassword(password)) return fail(res, 400, 'Mật khẩu phải có ít nhất 8 ký tự');
    if (password !== confirmPassword) return fail(res, 400, 'Mật khẩu xác nhận không khớp');
    const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (existingUsers.length) return fail(res, 409, 'Email đã được đăng ký');
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.execute(
      "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'USER')",
      [normalizedName, normalizedEmail, passwordHash]
    );
    return success(res, 201, 'Đăng ký tài khoản thành công', {
      id: result.insertId, fullName: normalizedName, email: normalizedEmail, role: 'USER'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Email đã được đăng ký');
    return serverError(res, 'Đăng ký tài khoản', error);
  }
};

// UC002 - Đăng nhập
const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
      return fail(res, 400, 'Vui lòng nhập email và mật khẩu');
    }
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) return fail(res, 400, 'Email không hợp lệ');
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );
    const user = rows[0];
    if (!user) return fail(res, 401, 'Email hoặc mật khẩu không chính xác');
    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) return fail(res, 401, 'Email hoặc mật khẩu không chính xác');
    if (!user.is_active) return fail(res, 403, 'Tài khoản đã bị khóa');
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
    return success(res, 200, 'Đăng nhập thành công', {
      token,
      user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role }
    });
  } catch (error) {
    return serverError(res, 'Đăng nhập', error);
  }
};

// UC002 - Khôi phục thông tin tài khoản từ JWT
const me = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, role, avatar_url, is_active FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    if (!user.is_active) return fail(res, 403, 'Tài khoản đã bị khóa');
    return success(res, 200, 'Lấy thông tin tài khoản thành công', {
      id: user.id, fullName: user.full_name, email: user.email,
      role: user.role, avatarUrl: user.avatar_url
    });
  } catch (error) {
    return serverError(res, 'Lấy thông tin tài khoản', error);
  }
};

// UC002 - Logout phía client: frontend xóa JWT đã lưu
const logout = (req, res) => {
  return success(res, 200, 'Đăng xuất thành công', null);
};

module.exports = { register, login, me, logout };
