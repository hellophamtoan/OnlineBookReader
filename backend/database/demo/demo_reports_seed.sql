-- demo_reports_seed.sql
-- DỮ LIỆU DEMO cho trang Thống kê & báo cáo (UC011). KHÔNG phải migration, không chạy trên DB thật của cửa hàng.
-- Tạo 10 khách hàng demo (email demoNN@nhasach14.vn, mật khẩu Demo@12345) và hoạt động của họ trong ~4 tháng gần nhất
-- (tính lùi từ lúc chạy): nạp ví, đặt sách (đủ các trạng thái), mua gói đọc, nhận gói miễn phí.
-- Dữ liệu tuân thủ quy tắc nghiệp vụ: trừ tồn kho, ví khớp lịch sử giao dịch, gói đọc cộng dồn, có audit log.
-- Xóa toàn bộ dữ liệu demo: chạy demo_reports_cleanup.sql.
--
-- MySQL Workbench: chọn đúng database backend đang dùng (dòng USE bên dưới), bấm tia sét để chạy cả file.

USE railway;                      -- đổi thành DB_NAME trong backend/.env nếu khác
SET time_zone = '+00:00';         -- DB lưu giờ UTC (khớp backend)
SET SQL_SAFE_UPDATES = 0;

DROP PROCEDURE IF EXISTS demo_topup;
DROP PROCEDURE IF EXISTS demo_seed_reports;
DELIMITER $$

-- Nạp ví do admin ghi nhận (giống chức năng UC013), giờ = p_at
CREATE PROCEDURE demo_topup(IN p_user INT, IN p_amount DECIMAL(12,2), IN p_at DATETIME, IN p_admin INT)
BEGIN
  DECLARE v_bal DECIMAL(12,2);
  UPDATE users SET wallet_balance = wallet_balance + p_amount WHERE id = p_user;
  SELECT wallet_balance INTO v_bal FROM users WHERE id = p_user;
  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, ref_type, ref_id, note, created_at)
  VALUES (p_user, 'TOPUP', p_amount, v_bal, 'ADMIN', p_admin, 'Nạp ví (dữ liệu demo)', p_at);
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, created_at)
  VALUES (p_admin, 'WALLET_TOPUP', 'USER', p_user, JSON_OBJECT('amount', p_amount, 'demo', TRUE), p_at);
END$$

CREATE PROCEDURE demo_seed_reports()
BEGIN
  DECLARE v_admin INT;
  DECLARE v_day INT DEFAULT 120;          -- số ngày lùi về quá khứ
  DECLARE v_i INT; DECLARE v_k INT; DECLARE v_n INT; DECLARE v_items INT;
  DECLARE v_user INT; DECLARE v_at DATETIME; DECLARE v_order INT;
  DECLARE v_total DECIMAL(12,2); DECLARE v_bal DECIMAL(12,2);
  DECLARE v_method VARCHAR(10); DECLARE v_status VARCHAR(12); DECLARE v_pay VARCHAR(10);
  DECLARE v_book INT; DECLARE v_title VARCHAR(255); DECLARE v_price DECIMAL(12,2); DECLARE v_qty INT;
  DECLARE v_plan INT; DECLARE v_plan_name VARCHAR(150); DECLARE v_plan_price DECIMAL(12,2); DECLARE v_days INT;
  DECLARE v_start DATETIME; DECLARE v_sub INT; DECLARE r DOUBLE;
  DECLARE v_name VARCHAR(100); DECLARE v_phone VARCHAR(20); DECLARE v_addr VARCHAR(255);

  IF EXISTS (SELECT 1 FROM users WHERE email LIKE 'demo%@nhasach14.vn') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Du lieu demo da ton tai. Chay demo_reports_cleanup.sql truoc neu muon tao lai.';
  END IF;
  SELECT id INTO v_admin FROM users WHERE role = 'ADMIN' AND is_active = 1 ORDER BY id LIMIT 1;
  IF v_admin IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Can it nhat 1 tai khoan ADMIN dang hoat dong.';
  END IF;
  IF (SELECT COUNT(*) FROM books WHERE status = 'active' AND has_physical = 1 AND price > 0 AND stock >= 5) < 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Can it nhat 3 sach giay dang ban, con hang.';
  END IF;

  -- 1. Khách hàng demo: 6 người đăng ký từ trước, 4 người đăng ký rải rác trong 4 tháng
  SET v_i = 1;
  WHILE v_i <= 10 DO
    SET v_at = TIMESTAMPADD(SECOND, -FLOOR(RAND() * 80000),
                 TIMESTAMPADD(DAY, -IF(v_i <= 6, 125 + v_i, 120 - (v_i - 6) * 25), UTC_TIMESTAMP()));
    INSERT INTO users (email, password_hash, full_name, phone, role, is_active, wallet_balance, created_at, updated_at)
    VALUES (CONCAT('demo', LPAD(v_i, 2, '0'), '@nhasach14.vn'),
            '$2b$10$DGDBxX667I6q2p.xsAIFzugX.G5HSxpu.ZlxsYR8Z0bv/BUMPHBiO',
            ELT(v_i, 'Trần Minh Anh', 'Lê Hoàng Nam', 'Phạm Thu Trang', 'Đỗ Quang Huy', 'Vũ Ngọc Lan',
                     'Hoàng Đức Minh', 'Bùi Thanh Hà', 'Ngô Gia Bảo', 'Đặng Khánh Linh', 'Phan Tuấn Kiệt'),
            CONCAT('09', LPAD(FLOOR(RAND() * 100000000), 8, '0')), 'USER', 1, 0, v_at, v_at);
    CALL demo_topup(LAST_INSERT_ID(), 500000, TIMESTAMPADD(HOUR, 1, v_at), v_admin);
    SET v_i = v_i + 1;
  END WHILE;

  -- 2. Hoạt động theo từng ngày, từ 120 ngày trước đến hôm nay
  WHILE v_day >= 0 DO
    -- 2a. Đơn hàng: 0-3 đơn/ngày
    SET v_n = FLOOR(RAND() * 4);
    SET v_i = 1;
    WHILE v_i <= v_n DO
      SET v_at = TIMESTAMPADD(SECOND, -FLOOR(RAND() * 50000), TIMESTAMPADD(DAY, -v_day, UTC_TIMESTAMP()));
      SET v_user = NULL;
      SELECT id, full_name, phone INTO v_user, v_name, v_phone FROM users
        WHERE email LIKE 'demo%@nhasach14.vn' AND created_at < TIMESTAMPADD(HOUR, -2, v_at) ORDER BY RAND() LIMIT 1;
      IF v_user IS NOT NULL THEN
        SET v_method = IF(RAND() < 0.6, 'COD', 'WALLET');
        SET r = RAND();
        IF v_day >= 5 THEN
          SET v_status = CASE WHEN r < 0.75 THEN 'DELIVERED' WHEN r < 0.88 THEN 'CANCELLED' ELSE 'FAILED' END;
        ELSE
          SET v_status = CASE WHEN r < 0.3 THEN 'PENDING' WHEN r < 0.5 THEN 'CONFIRMED'
                              WHEN r < 0.7 THEN 'SHIPPING' WHEN r < 0.9 THEN 'DELIVERED' ELSE 'CANCELLED' END;
        END IF;
        SET v_pay = CASE WHEN v_method = 'WALLET' AND v_status IN ('CANCELLED','FAILED') THEN 'REFUNDED'
                         WHEN v_method = 'WALLET' THEN 'PAID'
                         WHEN v_status = 'DELIVERED' THEN 'PAID' ELSE 'UNPAID' END;
        SET v_addr = ELT(1 + FLOOR(RAND() * 5), 'Số 3 Cầu Giấy, Láng Thượng, Đống Đa, Hà Nội',
          '12 Nguyễn Trãi, Thanh Xuân, Hà Nội', '45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
          '8 Trần Phú, Hải Châu, Đà Nẵng', '102 Lạch Tray, Ngô Quyền, Hải Phòng');

        INSERT INTO orders (user_id, status, payment_method, payment_status, total_amount, shipping_fee,
                            receiver_name, receiver_phone, shipping_address, note, created_at, updated_at)
        VALUES (v_user, v_status, v_method, v_pay, 0, 0, v_name, v_phone, v_addr, NULL, v_at, v_at);
        SET v_order = LAST_INSERT_ID();

        -- 1-3 đầu sách khác nhau, mỗi loại 1-2 cuốn
        SET v_items = 1 + FLOOR(RAND() * 3); SET v_k = 1; SET v_total = 0;
        WHILE v_k <= v_items DO
          SET v_book = NULL; SET v_qty = 1 + FLOOR(RAND() * 2);
          SELECT id, title, price INTO v_book, v_title, v_price FROM books
            WHERE status = 'active' AND has_physical = 1 AND price > 0 AND stock >= v_qty + 5   -- chừa lại ít nhất 5 cuốn để vẫn demo đặt hàng được
              AND id NOT IN (SELECT book_id FROM order_items WHERE order_id = v_order)
            ORDER BY RAND() LIMIT 1;
          IF v_book IS NOT NULL THEN
            INSERT INTO order_items (order_id, book_id, book_title, quantity, unit_price, subtotal)
            VALUES (v_order, v_book, v_title, v_qty, v_price, v_price * v_qty);
            SET v_total = v_total + v_price * v_qty;
            -- Đơn hủy/giao thất bại đã được hoàn kho nên tồn kho không đổi
            IF v_status NOT IN ('CANCELLED','FAILED') THEN
              UPDATE books SET stock = stock - v_qty WHERE id = v_book;
            END IF;
          END IF;
          SET v_k = v_k + 1;
        END WHILE;
        UPDATE orders SET total_amount = v_total WHERE id = v_order;

        IF v_method = 'WALLET' THEN
          SELECT wallet_balance INTO v_bal FROM users WHERE id = v_user;
          IF v_bal < v_total THEN
            CALL demo_topup(v_user, CEIL((v_total - v_bal + 200000) / 100000) * 100000, TIMESTAMPADD(MINUTE, -30, v_at), v_admin);
          END IF;
          UPDATE users SET wallet_balance = wallet_balance - v_total WHERE id = v_user;
          SELECT wallet_balance INTO v_bal FROM users WHERE id = v_user;
          INSERT INTO wallet_transactions (user_id, type, amount, balance_after, ref_type, ref_id, note, created_at)
          VALUES (v_user, 'PAY_ORDER', -v_total, v_bal, 'ORDER', v_order, CONCAT('Thanh toán đơn #', v_order), v_at);
          IF v_pay = 'REFUNDED' THEN
            UPDATE users SET wallet_balance = wallet_balance + v_total WHERE id = v_user;
            SELECT wallet_balance INTO v_bal FROM users WHERE id = v_user;
            INSERT INTO wallet_transactions (user_id, type, amount, balance_after, ref_type, ref_id, note, created_at)
            VALUES (v_user, 'REFUND', v_total, v_bal, 'ORDER', v_order, CONCAT('Hoàn tiền đơn #', v_order), TIMESTAMPADD(HOUR, 3, v_at));
          END IF;
        END IF;

        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, created_at)
        VALUES (v_user, 'ORDER_CREATE', 'ORDER', v_order, JSON_OBJECT('paymentMethod', v_method, 'total', v_total, 'demo', TRUE), v_at);
        IF v_status <> 'PENDING' THEN
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, created_at)
          VALUES (v_admin, 'ORDER_STATUS_CHANGE', 'ORDER', v_order, JSON_OBJECT('from', 'PENDING', 'to', v_status, 'demo', TRUE), TIMESTAMPADD(HOUR, 3, v_at));
        END IF;
      END IF;
      SET v_i = v_i + 1;
    END WHILE;

    -- 2b. Mua gói đọc: khoảng 1/3 số ngày có 1 lượt (trả bằng ví, cộng dồn thời hạn)
    IF RAND() < 0.33 THEN
      SET v_at = TIMESTAMPADD(SECOND, -FLOOR(RAND() * 50000), TIMESTAMPADD(DAY, -v_day, UTC_TIMESTAMP()));
      SET v_user = NULL;
      SELECT id INTO v_user FROM users
        WHERE email LIKE 'demo%@nhasach14.vn' AND created_at < TIMESTAMPADD(HOUR, -2, v_at) ORDER BY RAND() LIMIT 1;
      SET v_plan = NULL;
      SELECT id, name, price, duration_days INTO v_plan, v_plan_name, v_plan_price, v_days FROM reading_plans
        WHERE status = 'active' AND plan_kind = 'fixed' AND price > 0 ORDER BY RAND() LIMIT 1;
      IF v_user IS NOT NULL AND v_plan IS NOT NULL THEN
        SELECT GREATEST(v_at, COALESCE(MAX(end_date), v_at)) INTO v_start FROM subscriptions WHERE user_id = v_user;
        SELECT wallet_balance INTO v_bal FROM users WHERE id = v_user;
        IF v_bal < v_plan_price THEN
          CALL demo_topup(v_user, CEIL((v_plan_price - v_bal + 100000) / 100000) * 100000, TIMESTAMPADD(MINUTE, -30, v_at), v_admin);
        END IF;
        INSERT INTO subscriptions (user_id, plan_id, plan_name, price_paid, duration_days, start_date, end_date, plan_kind, created_at)
        VALUES (v_user, v_plan, v_plan_name, v_plan_price, v_days, v_start, TIMESTAMPADD(DAY, v_days, v_start), 'fixed', v_at);
        SET v_sub = LAST_INSERT_ID();
        UPDATE users SET wallet_balance = wallet_balance - v_plan_price WHERE id = v_user;
        SELECT wallet_balance INTO v_bal FROM users WHERE id = v_user;
        INSERT INTO wallet_transactions (user_id, type, amount, balance_after, ref_type, ref_id, note, created_at)
        VALUES (v_user, 'PAY_PLAN', -v_plan_price, v_bal, 'SUBSCRIPTION', v_sub, CONCAT('Mua ', v_plan_name), v_at);
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, created_at)
        VALUES (v_user, 'SUBSCRIPTION_CREATE', 'SUBSCRIPTION', v_sub,
                JSON_OBJECT('planId', v_plan, 'price', v_plan_price, 'days', v_days, 'demo', TRUE), v_at);
      END IF;
    END IF;

    SET v_day = v_day - 1;
  END WHILE;

  -- 3. Gói miễn phí (mỗi tài khoản 1 lần): 3 khách nhận trong tháng này
  SET v_plan = NULL;
  SELECT id, name, duration_days INTO v_plan, v_plan_name, v_days FROM reading_plans
    WHERE status = 'active' AND plan_kind = 'fixed' AND price = 0 ORDER BY id LIMIT 1;
  IF v_plan IS NOT NULL THEN
    SET v_i = 1;
    WHILE v_i <= 3 DO
      SET v_user = NULL;
      SELECT id INTO v_user FROM users
        WHERE email = CONCAT('demo', LPAD(v_i + 7, 2, '0'), '@nhasach14.vn')
          AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = users.id AND s.price_paid = 0 AND s.plan_kind = 'fixed');
      IF v_user IS NOT NULL THEN
        SET v_at = TIMESTAMPADD(HOUR, -(v_i * 20), UTC_TIMESTAMP());
        SELECT GREATEST(v_at, COALESCE(MAX(end_date), v_at)) INTO v_start FROM subscriptions WHERE user_id = v_user;
        INSERT INTO subscriptions (user_id, plan_id, plan_name, price_paid, duration_days, start_date, end_date, plan_kind, created_at)
        VALUES (v_user, v_plan, v_plan_name, 0, v_days, v_start, TIMESTAMPADD(DAY, v_days, v_start), 'fixed', v_at);
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, detail, created_at)
        VALUES (v_user, 'SUBSCRIPTION_CREATE', 'SUBSCRIPTION', LAST_INSERT_ID(),
                JSON_OBJECT('planId', v_plan, 'price', 0, 'days', v_days, 'demo', TRUE), v_at);
      END IF;
      SET v_i = v_i + 1;
    END WHILE;
  END IF;
END$$
DELIMITER ;

START TRANSACTION;
CALL demo_seed_reports();
COMMIT;

DROP PROCEDURE demo_seed_reports;
DROP PROCEDURE demo_topup;

-- Kiểm tra nhanh
SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+07:00'), '%Y-%m') AS thang,
       COUNT(*) AS so_don, SUM(status = 'DELIVERED') AS da_giao,
       SUM(IF(status = 'DELIVERED', total_amount, 0)) AS doanh_thu_don
FROM orders GROUP BY thang ORDER BY thang;
SELECT COUNT(*) AS so_luot_mua_goi, SUM(price_paid) AS doanh_thu_goi FROM subscriptions;
-- Ví phải khớp lịch sử giao dịch (cột lech = 0 với khách demo)
SELECT u.email, u.wallet_balance,
       (SELECT COALESCE(SUM(w.amount), 0) FROM wallet_transactions w WHERE w.user_id = u.id) AS tong_giao_dich,
       u.wallet_balance - (SELECT COALESCE(SUM(w.amount), 0) FROM wallet_transactions w WHERE w.user_id = u.id) AS lech
FROM users u WHERE u.email LIKE 'demo%@nhasach14.vn' ORDER BY u.email;
