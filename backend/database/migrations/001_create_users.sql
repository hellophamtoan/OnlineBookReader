-- 001_create_users.sql
-- Bảng người dùng (UC001, UC002, UC010, UC012, UC013).
-- Chạy: mysql -u root -p online_book_reader < 001_create_users.sql
-- Nếu đã chạy bản cũ (role 'READER'): DROP TABLE users; rồi chạy lại file này.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  avatar_url VARCHAR(500) NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  -- false = tài khoản bị khóa (UC010): không đăng nhập được, token cũ cũng vô hiệu
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Số dư ví, chỉ được cập nhật cùng transaction với wallet_transactions
  wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  -- Số lần giao hàng thất bại (UC009), dùng cho cơ chế khóa tự động nếu làm
  failed_delivery_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
