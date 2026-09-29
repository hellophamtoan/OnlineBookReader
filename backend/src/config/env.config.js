// config/env.config.js
// Đọc và kiểm tra các biến môi trường bắt buộc ngay lúc khởi động server,
// tránh lỗi mơ hồ khi chạy đến giữa chừng mới báo thiếu config.

require('dotenv').config();

const REQUIRED_ENV_VARS = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
    console.error('Hãy copy .env.example thành .env và điền đầy đủ giá trị.');
    process.exit(1);
  }
};

module.exports = { validateEnv };
