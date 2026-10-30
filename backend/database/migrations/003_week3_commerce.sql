-- OnlineBookReader · Migration tuong thich schema Railway cu (Week 3)
-- CHAY THAY CHO 003_week3_commerce.sql (khong chay ca hai).
-- Backup DB truoc khi chay. Script duoc thiet ke theo anh schema: 5 bang giao dich rong.
-- Khong DROP/TRUNCATE bang, khong xoa du lieu users/books/reading_plans/subscriptions.
-- Yeu cau MySQL 8.0+, schema railway, va users.id / books.id la INT co dau.
USE railway;

-- 1. Chan ngay neu schema khong dung hoac 5 bang giao dich da co du lieu.
DROP PROCEDURE IF EXISTS w3c_precheck;
DELIMITER $$
CREATE PROCEDURE w3c_precheck()
BEGIN
  DECLARE n BIGINT DEFAULT 0;
  IF DATABASE() <> 'railway' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Phai chon database railway';
  END IF;
  SELECT (SELECT COUNT(*) FROM carts) +
         (SELECT COUNT(*) FROM cart_items) +
         (SELECT COUNT(*) FROM orders) +
         (SELECT COUNT(*) FROM order_items) +
         (SELECT COUNT(*) FROM wallet_transactions) INTO n;
  IF n <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Bang giao dich khong con rong. Dung lai, can migration chuyen du lieu';
  END IF;
  IF EXISTS (
    SELECT LOWER(TRIM(name)) FROM reading_plans WHERE status='active'
    GROUP BY LOWER(TRIM(name)) HAVING COUNT(*)>1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Trung ten goi active; xu ly trung ten truoc';
  END IF;
END$$
DELIMITER ;
CALL w3c_precheck();
DROP PROCEDURE w3c_precheck;

-- 2. Thu tuc them cot/index/FK neu chua co, de chay lai khi can.
DROP PROCEDURE IF EXISTS w3c_add_col;
DROP PROCEDURE IF EXISTS w3c_add_idx;
DELIMITER $$
CREATE PROCEDURE w3c_add_col(IN t VARCHAR(64),IN c VARCHAR(64),IN ddl TEXT)
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=t AND COLUMN_NAME=c) THEN
    SET @sql=CONCAT('ALTER TABLE `',t,'` ADD COLUMN ',ddl);
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END$$
CREATE PROCEDURE w3c_add_idx(IN t VARCHAR(64),IN idx VARCHAR(64),IN clause TEXT)
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=t AND INDEX_NAME=idx) THEN
    SET @sql=CONCAT('ALTER TABLE `',t,'` ADD ',clause);
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END$$
DELIMITER ;

-- 3. reading_plans: KHONG tao lai cac goi da co.
CALL w3c_add_col('reading_plans','updated_at',
  '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL w3c_add_col('reading_plans','active_name_key',
  "`active_name_key` VARCHAR(100) GENERATED ALWAYS AS (CASE WHEN status='active' THEN LOWER(TRIM(name)) ELSE NULL END) STORED");
CALL w3c_add_idx('reading_plans','uq_w3_active_plan_name',
  'UNIQUE KEY uq_w3_active_plan_name(active_name_key)');

-- 4. cart_items ban cu gom id, cart_id, book_id, quantity; backend moi dung user_id.
-- cart_id duoc giu lai cho tuong thich cu, nhung cho NULL de API moi INSERT khong can carts.
CALL w3c_add_col('cart_items','user_id','`user_id` INT NOT NULL');
CALL w3c_add_col('cart_items','created_at',
  '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
CALL w3c_add_col('cart_items','updated_at',
  '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
-- Bao toan kieu cart_id, tam go FK cart_id neu MySQL chan MODIFY, roi gan lai.
-- Du lieu cart_items dang rong, ma ten FK duoc lay tu information_schema.
DROP PROCEDURE IF EXISTS w3c_relax_cart_id;
DELIMITER $$
CREATE PROCEDURE w3c_relax_cart_id()
BEGIN
  DECLARE p_type VARCHAR(120);
  DECLARE p_nullable VARCHAR(3);
  DECLARE p_fk VARCHAR(64);
  SELECT COLUMN_TYPE,IS_NULLABLE INTO p_type,p_nullable
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cart_items' AND COLUMN_NAME='cart_id';
  IF p_type IS NOT NULL AND p_nullable='NO' THEN
    SELECT CONSTRAINT_NAME INTO p_fk FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cart_items'
        AND COLUMN_NAME='cart_id' AND REFERENCED_TABLE_NAME='carts' LIMIT 1;
    IF p_fk IS NOT NULL THEN
      SET @sql=CONCAT('ALTER TABLE cart_items DROP FOREIGN KEY `',p_fk,'`');
      PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
    SET @sql=CONCAT('ALTER TABLE cart_items MODIFY COLUMN cart_id ',p_type,' NULL');
    PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    IF p_fk IS NOT NULL THEN
      SET @sql=CONCAT('ALTER TABLE cart_items ADD CONSTRAINT `',p_fk,
        '` FOREIGN KEY (cart_id) REFERENCES carts(id)');
      PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
    END IF;
  END IF;
END$$
DELIMITER ;
CALL w3c_relax_cart_id();
DROP PROCEDURE w3c_relax_cart_id;
CALL w3c_add_idx('cart_items','uq_w3_cart_user_book',
  'UNIQUE KEY uq_w3_cart_user_book(user_id,book_id)');
CALL w3c_add_idx('cart_items','fk_w3_cart_user',
  'CONSTRAINT fk_w3_cart_user FOREIGN KEY(user_id) REFERENCES users(id)');

-- 5. orders: giu nguyen bang va khoa ngoai cu; chuyen ENUM ve viet HOA theo code API.
CALL w3c_add_col('orders','shipping_fee','`shipping_fee` DECIMAL(14,2) NOT NULL DEFAULT 0');
CALL w3c_add_col('orders','receiver_name','`receiver_name` VARCHAR(100) NULL');
CALL w3c_add_col('orders','receiver_phone','`receiver_phone` VARCHAR(20) NULL');
CALL w3c_add_col('orders','note','`note` VARCHAR(255) NULL');
CALL w3c_add_col('orders','updated_at',
  '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL w3c_add_col('orders','payment_status',
  "`payment_status` ENUM('UNPAID','PAID','REFUNDED') NOT NULL DEFAULT 'UNPAID'");
ALTER TABLE orders MODIFY COLUMN status
  ENUM('PENDING','PREPARING','SHIPPING','DELIVERED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING';
ALTER TABLE orders MODIFY COLUMN payment_status
  ENUM('UNPAID','PAID','REFUNDED') NOT NULL DEFAULT 'UNPAID';

-- 6. order_items rong: bo sung gia tri do backend tinh khi tao don.
CALL w3c_add_col('order_items','book_title','`book_title` VARCHAR(255) NULL');
CALL w3c_add_col('order_items','unit_price','`unit_price` DECIMAL(14,2) NULL');
CALL w3c_add_col('order_items','subtotal','`subtotal` DECIMAL(14,2) NOT NULL DEFAULT 0');

-- 7. wallet_transactions: them loai giao dich tuan 3; giu cac cot lich su cu.
CALL w3c_add_col('wallet_transactions','type',
  "`type` ENUM('TOPUP','PAY_ORDER','PAY_PLAN','REFUND') NOT NULL");
CALL w3c_add_col('wallet_transactions','ref_type','`ref_type` VARCHAR(30) NULL');
CALL w3c_add_col('wallet_transactions','ref_id','`ref_id` INT NULL');
CALL w3c_add_col('wallet_transactions','external_reference','`external_reference` VARCHAR(100) NULL');
CALL w3c_add_idx('wallet_transactions','uq_w3_wallet_external_reference',
  'UNIQUE KEY uq_w3_wallet_external_reference(external_reference)');

-- 8. Audit logs: giu du lieu audit cu (neu co) nen user_id moi de NULL.
CALL w3c_add_col('audit_logs','user_id','`user_id` INT NULL');
CALL w3c_add_col('audit_logs','detail','`detail` JSON NULL');

-- 9. Bang idempotency moi chong thanh toan 2 lan.
CREATE TABLE IF NOT EXISTS idempotency_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  operation VARCHAR(60) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status ENUM('PROCESSING','COMPLETED') NOT NULL DEFAULT 'PROCESSING',
  response_status SMALLINT NULL,
  response_body JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_w3_idempotency(user_id,operation,idempotency_key),
  KEY idx_w3_idempotency_created(created_at),
  CONSTRAINT fk_w3_idempotency_user FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE w3c_add_col;
DROP PROCEDURE w3c_add_idx;

-- 10. Kiem tra cac cot bat buoc cu co the lam backend tuan 3 INSERT that bai.
-- Neu truy van nay tra ket qua, can xu ly truoc khi kiem thu thanh toan.
SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('cart_items','orders','order_items','wallet_transactions','audit_logs')
  AND IS_NULLABLE='NO' AND COLUMN_DEFAULT IS NULL AND EXTRA NOT LIKE '%auto_increment%'
  AND COLUMN_NAME NOT IN (
    'user_id','book_id','cart_id','quantity',
    'status','payment_method','total_amount','shipping_address',
    'order_id','book_title','unit_price','subtotal','type','amount','balance_after',
    'action','entity_type','entity_id'
  )
ORDER BY TABLE_NAME,COLUMN_NAME;
