-- Chạy trong MySQL Workbench, database backend đang kết nối (ví dụ railway).
-- Không xóa/sửa dữ liệu sách, chương, tiến trình hiện có.
-- Yêu cầu users.id và books.id là INT có cùng signedness.
CREATE TABLE IF NOT EXISTS user_library (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_id INT NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_library_user_book (user_id, book_id),
  INDEX idx_user_library_book (book_id),
  CONSTRAINT fk_user_library_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_library_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API-39b cần reading_progress.updated_at để xếp sách theo lần đọc mới nhất.
-- Nếu cột đã tồn tại, lệnh ALTER được bỏ qua (an toàn khi chạy lại script).
SET @rp_has_updated_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reading_progress' AND COLUMN_NAME = 'updated_at'
);
SET @rp_alter_sql = IF(@rp_has_updated_at = 0,
  'ALTER TABLE reading_progress ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT ''reading_progress.updated_at da ton tai'' AS message'
);
PREPARE stmt FROM @rp_alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
