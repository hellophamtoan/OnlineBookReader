const SALT_ROUNDS = 10;

const normalizeEmail = (email) => email.trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPassword = (password) => typeof password === 'string' && password.length >= 8;
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

module.exports = { normalizeEmail, isValidEmail, isValidPassword, isNonEmptyString, SALT_ROUNDS };
