-- 006_wallet_topup.sql
-- UC013 - Nạp ví bằng QR chuyển khoản (VietQR): yêu cầu nạp + tài khoản nhận tiền của cửa hàng.
-- Chạy sau 001..005. Có thể chạy lại (IF NOT EXISTS). Không đụng dữ liệu cũ.
-- Ví chỉ được cộng khi ADMIN xác nhận đã nhận tiền (ghi vào wallet_transactions, type = 'TOPUP').

-- Yêu cầu nạp của người dùng
CREATE TABLE IF NOT EXISTS wallet_topup_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  -- Mã yêu cầu, đồng thời là nội dung chuyển khoản (chỉ gồm chữ + số, tối đa 25 ký tự)
  order_code VARCHAR(25) NOT NULL,
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  gateway ENUM('BANK_QR') NOT NULL DEFAULT 'BANK_QR',
  status ENUM('PENDING','PAID','FAILED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  note VARCHAR(255) NULL,
  -- Mã giao dịch ghi nhận khi admin xác nhận (ADMIN-<id>-<timestamp>)
  gateway_txn_id VARCHAR(100) NULL,
  paid_at TIMESTAMP NULL,
  confirmed_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_topup_order_code (order_code),
  KEY idx_topup_user_created (user_id, created_at),
  KEY idx_topup_status (status),
  CONSTRAINT fk_topup_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_topup_admin FOREIGN KEY (confirmed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tài khoản ngân hàng nhận tiền của cửa hàng (chỉ 1 dòng, id = 1)
CREATE TABLE IF NOT EXISTS store_bank_accounts (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  bin CHAR(6) NOT NULL,
  account_no VARCHAR(20) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_store_bank_single CHECK (id = 1),
  CONSTRAINT fk_store_bank_admin FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
