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
});

module.exports = pool;
