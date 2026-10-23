const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { normalizeEmail, isValidEmail, isNonEmptyString, isValidPhone, isHttpUrl } = require('../utils/validators');

const toProfile = (u) => ({
  id: u.id, fullName: u.full_name, email: u.email, phone: u.phone, avatarUrl: u.avatar_url,
  role: u.role, walletBalance: Number(u.wallet_balance), createdAt: u.created_at
});

const findProfile = async (id) => {
  const [rows] = await pool.execute(
    'SELECT id, full_name, email, phone, avatar_url, role, wallet_balance, created_at FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0];
};

// UC012 bước 1-2 - Xem hồ sơ (không bao giờ trả password_hash)
const getProfile = async (req, res) => {
  try {
    const user = await findProfile(req.user.id);
    if (!user) return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    return success(res, 200, 'Lấy thông tin cá nhân thành công', toProfile(user));
  } catch (error) {
    return serverError(res, 'Lấy thông tin cá nhân', error);
  }
};

// UC012 bước 5-8 - Cập nhật hồ sơ (người dùng và Admin đều dùng)
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phone, avatarUrl } = req.body || {};
    if (!isNonEmptyString(fullName) || !isNonEmptyString(email)) {
      return fail(res, 400, 'Vui lòng nhập họ tên và email');
    }
    const name = fullName.trim();
    const mail = normalizeEmail(email);
    if (name.length > 100) return fail(res, 400, 'Họ tên không được vượt quá 100 ký tự');
    if (!isValidEmail(mail) || mail.length > 255) return fail(res, 400, 'Email không hợp lệ');

    // phone / avatarUrl: bỏ trống hoặc null = xóa giá trị
    const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    if (hasValue(phone) && (!isValidPhone(String(phone).trim()) || String(phone).trim().length > 20)) {
      return fail(res, 400, 'Số điện thoại không hợp lệ');
    }
    if (hasValue(avatarUrl) && (typeof avatarUrl !== 'string' || avatarUrl.trim().length > 500 || !isHttpUrl(avatarUrl.trim()))) {
      return fail(res, 400, 'Đường dẫn ảnh đại diện không hợp lệ');
    }

    const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [mail, req.user.id]);
    if (dup.length) return fail(res, 409, 'Email đã được sử dụng bởi tài khoản khác');

    await pool.execute(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, avatar_url = ? WHERE id = ?',
      [name, mail, hasValue(phone) ? String(phone).trim() : null, hasValue(avatarUrl) ? avatarUrl.trim() : null, req.user.id]
    );
    const user = await findProfile(req.user.id);
    return success(res, 200, 'Cập nhật thông tin cá nhân thành công', toProfile(user));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Email đã được sử dụng bởi tài khoản khác');
    return serverError(res, 'Cập nhật thông tin cá nhân', error);
  }
};

module.exports = { getProfile, updateProfile };
