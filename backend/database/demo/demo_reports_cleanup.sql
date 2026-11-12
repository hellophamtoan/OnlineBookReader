-- demo_reports_cleanup.sql
-- Xóa TOÀN BỘ dữ liệu do demo_reports_seed.sql tạo (khách demoNN@nhasach14.vn và mọi thứ liên quan),
-- trả lại tồn kho cho các đơn demo chưa hủy. Không đụng tới dữ liệu khác.

USE railway;                      -- đổi thành DB_NAME trong backend/.env nếu khác
SET SQL_SAFE_UPDATES = 0;

START TRANSACTION;

-- Hoàn tồn kho của đơn demo đã trừ kho (đơn hủy/giao thất bại đã được hoàn khi tạo)
UPDATE books b
JOIN (SELECT oi.book_id, SUM(oi.quantity) AS qty
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      JOIN users u ON u.id = o.user_id
      WHERE u.email LIKE 'demo%@nhasach14.vn' AND o.status NOT IN ('CANCELLED','FAILED')
      GROUP BY oi.book_id) x ON x.book_id = b.id
SET b.stock = b.stock + x.qty;

DELETE FROM audit_logs
WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn')
   OR (entity_type = 'USER' AND entity_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn'))
   OR (entity_type = 'ORDER' AND entity_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn')));
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn'));
DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM wallet_transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM wallet_topup_requests WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM subscriptions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM idempotency_requests WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM reading_progress WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM user_library WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM cart_items WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'demo%@nhasach14.vn');
DELETE FROM users WHERE email LIKE 'demo%@nhasach14.vn';

COMMIT;

SELECT COUNT(*) AS khach_demo_con_lai FROM users WHERE email LIKE 'demo%@nhasach14.vn';
