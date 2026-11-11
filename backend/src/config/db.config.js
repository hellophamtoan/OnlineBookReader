// config/db.config.js
// Tao 1 connection pool MySQL dung chung cho toan bo app.
// Dung pool thay vi tao ket noi moi moi lan query, giup toi uu hieu nang.

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Thống nhất múi giờ UTC giữa Node và MySQL: DATETIME (start_date/end_date của gói đọc)
  // được đọc/ghi theo UTC, tránh lệch 7 tiếng khi backend chạy trên máy múi giờ +07:00.
  timezone: 'Z',
});

// Mỗi kết nối mới đặt time_zone của phiên về UTC để NOW() khớp với dữ liệu đã lưu
// (Railway chạy UTC; MySQL cài trên Windows mặc định theo giờ máy +07:00).
if (pool.pool && typeof pool.pool.on === 'function') {
  pool.pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
}

module.exports = pool;
