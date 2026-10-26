const SALT_ROUNDS = 10;

const normalizeEmail = (email) => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) => typeof password === 'string' && password.length >= 8;
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
// Số nguyên dương (nhận cả số lẫn chuỗi số, vd. param trên URL)
const isPositiveInt = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
// Số điện thoại: 9-15 chữ số, cho phép dấu +, khoảng trắng, chấm, gạch ngang
const isValidPhone = (value) => typeof value === 'string' && /^\+?\d{9,15}$/.test(value.replace(/[\s.-]/g, ''));

module.exports = {
  normalizeEmail, isValidEmail, isValidPassword, isNonEmptyString,
  isPositiveInt, isHttpUrl, isValidPhone, SALT_ROUNDS
};
