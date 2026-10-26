const bcrypt = require('bcrypt');
const pool = require('../config/db.config');
const { success, fail, serverError } = require('../utils/response');
const { normalizeEmail, isValidEmail, isNonEmptyString, isValidPhone, isHttpUrl, isValidPassword, SALT_ROUNDS } = require('../utils/validators');

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
    const { fullName, email, phone, avatarUrl, currentPassword, newPassword, confirmNewPassword } = req.body || {};
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
    const isUploadPath = (v) => /^\/uploads\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(v) && !v.split('/').includes('..');
    if (hasValue(avatarUrl) && (typeof avatarUrl !== 'string' || avatarUrl.trim().length > 500 || (!isHttpUrl(avatarUrl.trim()) && !isUploadPath(avatarUrl.trim())))) {
      return fail(res, 400, 'Đường dẫn ảnh đại diện không hợp lệ');
    }

    // Ba trường mật khẩu là một nhóm: chỉ đổi mật khẩu khi cung cấp đủ cả ba.
    const passwordInputs = [currentPassword, newPassword, confirmNewPassword];
    const wantsPasswordChange = passwordInputs.some(v => v !== undefined && v !== null && v !== '');
    let oldHash = null;
    let newHash = null;
    if (wantsPasswordChange) {
      if (!passwordInputs.every(v => typeof v === 'string' && v.length > 0)) {
        return fail(res, 400, 'Vui lòng nhập đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới');
      }
      if (!isValidPassword(newPassword) || Buffer.byteLength(newPassword, 'utf8') > 72) {
        return fail(res, 400, 'Mật khẩu mới phải có ít nhất 8 ký tự và không quá 72 byte');
      }
      if (newPassword !== confirmNewPassword) return fail(res, 400, 'Xác nhận mật khẩu mới không khớp');
      const [accounts] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      if (!accounts.length) return fail(res, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
      oldHash = accounts[0].password_hash;
      if (!await bcrypt.compare(currentPassword, oldHash)) {
        return fail(res, 400, 'Mật khẩu hiện tại không chính xác');
      }
      newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    }

    const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [mail, req.user.id]);
    if (dup.length) return fail(res, 409, 'Email đã được sử dụng bởi tài khoản khác');

    const phoneValue = hasValue(phone) ? String(phone).trim() : null;
    const avatarValue = hasValue(avatarUrl) ? avatarUrl.trim() : null;
    if (wantsPasswordChange) {
      // Điều kiện password_hash tránh ghi đè nếu mật khẩu bị thay đổi bởi request khác.
      const [result] = await pool.execute(
        'UPDATE users SET full_name = ?, email = ?, phone = ?, avatar_url = ?, password_hash = ? WHERE id = ? AND password_hash = ?',
        [name, mail, phoneValue, avatarValue, newHash, req.user.id, oldHash]
      );
      if (result.affectedRows === 0) return fail(res, 409, 'Mật khẩu đã thay đổi; vui lòng thử lại');
    } else {
      await pool.execute(
        'UPDATE users SET full_name = ?, email = ?, phone = ?, avatar_url = ? WHERE id = ?',
        [name, mail, phoneValue, avatarValue, req.user.id]
      );
    }
    const user = await findProfile(req.user.id);
    return success(res, 200, 'Cập nhật thông tin cá nhân thành công', toProfile(user));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Email đã được sử dụng bởi tài khoản khác');
    return serverError(res, 'Cập nhật thông tin cá nhân', error);
  }
};

module.exports = { getProfile, updateProfile };
