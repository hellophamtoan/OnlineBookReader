-- 008_user_address.sql
-- UC012: thêm cột địa chỉ cho hồ sơ người dùng (dùng điền sẵn khi đặt hàng).
-- Chạy được nhiều lần; chọn đúng DB_NAME trong .env trước khi chạy:
--   mysql -u root -p online_book_reader < backend/database/migrations/008_user_address.sql
SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'address');
SET @sql = IF(@has_col = 0, 'ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL AFTER phone',
  'SELECT ''users.address da ton tai'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
