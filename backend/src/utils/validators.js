// utils/validators.js
// Hằng số và hàm kiểm tra dùng chung cho đăng ký, đăng nhập...
// Các hàm an toàn với dữ liệu thiếu/sai kiểu (undefined, số, object) - không ném lỗi.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const SALT_ROUNDS = 10;

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

// Trả về chuỗi email đã chuẩn hóa, hoặc '' nếu đầu vào không phải chuỗi
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

const isValidEmail = (email) => typeof email === 'string' && EMAIL_REGEX.test(email);

const isValidPassword = (password) =>
  typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;

module.exports = {
  EMAIL_REGEX,
  MIN_PASSWORD_LENGTH,
  SALT_ROUNDS,
  isNonEmptyString,
  normalizeEmail,
  isValidEmail,
  isValidPassword,
};
