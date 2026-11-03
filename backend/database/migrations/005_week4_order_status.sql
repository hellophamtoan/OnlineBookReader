-- Chọn database hiện có trước khi chạy. Sao lưu trước khi migration.
-- Áp dụng sau 001..004 trên schema hiện có; có thể chạy lại.
ALTER TABLE orders MODIFY COLUMN status ENUM('PENDING','PREPARING','CONFIRMED','SHIPPING','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING';
UPDATE orders SET status='CONFIRMED' WHERE status='PREPARING';
ALTER TABLE orders MODIFY COLUMN status ENUM('PENDING','CONFIRMED','SHIPPING','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING';
