-- 007_fix_final.sql
-- Vá schema cho DB ĐÃ CÓ DỮ LIỆU (đã chạy 001..006 hoặc bản sao từ Railway).
-- DB cài mới thì KHÔNG cần file này: dùng schema.sql + seed.sql (đã gồm sẵn các sửa đổi dưới đây).
-- Chọn đúng database backend đang kết nối (DB_NAME trong .env) trước khi chạy. Có thể chạy lại nhiều lần.
--   mysql -u root -p railway < backend/database/migrations/007_fix_final.sql

-- 1. Trạng thái đơn hàng: backend dùng CONFIRMED ("Đang chuẩn bị").
--    DB cũ còn PREPARING nên admin xác nhận đơn bị lỗi "Data truncated for column 'status'".
ALTER TABLE orders MODIFY COLUMN status
  ENUM('PENDING','PREPARING','CONFIRMED','SHIPPING','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING';
UPDATE orders SET status = 'CONFIRMED' WHERE status = 'PREPARING';
ALTER TABLE orders MODIFY COLUMN status
  ENUM('PENDING','CONFIRMED','SHIPPING','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING';

-- 2. wallet_transactions.transaction_type là cột cũ, code không dùng (đã thay bằng cột type).
--    Cột này NOT NULL nên MySQL tự điền 'topup' cho MỌI giao dịch, kể cả thanh toán -> dữ liệu sai. Xóa cột.
SET @has_col = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wallet_transactions' AND COLUMN_NAME = 'transaction_type');
SET @sql = IF(@has_col > 0, 'ALTER TABLE wallet_transactions DROP COLUMN transaction_type',
  'SELECT ''transaction_type da duoc xoa'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Kiểm tra: kết quả phải là 0 dòng (không còn cột bắt buộc nào mà code không ghi).
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('orders','order_items','wallet_transactions','audit_logs','cart_items','subscriptions')
  AND IS_NULLABLE = 'NO' AND COLUMN_DEFAULT IS NULL AND EXTRA NOT LIKE '%auto_increment%'
  AND EXTRA NOT LIKE '%GENERATED%'
  AND COLUMN_NAME NOT IN ('user_id','book_id','quantity','shipping_address','payment_method','total_amount',
    'order_id','book_title','unit_price','amount','balance_after','type','action','entity_type',
    'plan_id','plan_name','price_paid','duration_days','start_date','end_date');
