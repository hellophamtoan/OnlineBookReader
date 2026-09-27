// config/env.config.js
// Doc va kiem tra cac bien moi truong bat buoc ngay luc khoi dong server,
// tranh loi mo ho khi chay den giua chung moi bao thieu config.

require('dotenv').config();

const REQUIRED_ENV_VARS = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
  'JWT_SECRET',
];

const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Thieu bien moi truong bat buoc: ${missing.join(', ')}`);
    console.error('Hay copy .env.example thanh .env va dien day du gia tri.');
    process.exit(1);
  }
};

module.exports = { validateEnv };
