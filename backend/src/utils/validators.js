const SALT_ROUNDS = 10;

// [Backend] Chuẩn hóa email (bỏ khoảng trắng, chữ thường).
const normalizeEmail = (email) => email.trim().toLowerCase();
// [Backend] Kiểm tra định dạng email.
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// [Backend] Kiểm tra mật khẩu tối thiểu 8 ký tự.
const isValidPassword = (password) => typeof password === 'string' && password.length >= 8;
// [Backend] Kiểm tra chuỗi không rỗng.
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
// [Backend] Kiểm tra số nguyên dương.
const isPositiveInt = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
// [Backend] Kiểm tra đường dẫn http/https.
const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
// [Backend] Kiểm tra số điện thoại 9–15 chữ số.
const isValidPhone = (value) => typeof value === 'string' && /^\+?\d{9,15}$/.test(value.replace(/[\s.-]/g, ''));

module.exports = {
  normalizeEmail, isValidEmail, isValidPassword, isNonEmptyString,
  isPositiveInt, isHttpUrl, isValidPhone, SALT_ROUNDS
};
