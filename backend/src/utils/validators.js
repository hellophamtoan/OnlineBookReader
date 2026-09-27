// utils/validators.js
// Cac hang so va ham kiem tra dung chung cho dang ky, dang nhap...

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const SALT_ROUNDS = 10;

const normalizeEmail = (email) => email.trim().toLowerCase();
const isValidEmail = (email) => EMAIL_REGEX.test(email);

module.exports = {
  EMAIL_REGEX,
  MIN_PASSWORD_LENGTH,
  SALT_ROUNDS,
  normalizeEmail,
  isValidEmail,
};
