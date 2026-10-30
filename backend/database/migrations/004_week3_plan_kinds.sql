-- OnlineBookReader: Erweiterung UC005/UC008 (custom, lifetime, free trial).
-- Run only AFTER 003_week3_commerce.sql. Preserves all existing subscriptions.
-- Migration is idempotent for columns; no data rows are deleted.
USE railway;
DROP PROCEDURE IF EXISTS w4_add_col;
DELIMITER $$
CREATE PROCEDURE w4_add_col(IN t VARCHAR(64), IN c VARCHAR(64), IN definition_sql TEXT)
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=t AND COLUMN_NAME=c) THEN
    SET @ddl=CONCAT('ALTER TABLE `', t, '` ADD COLUMN ', definition_sql);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;
CALL w4_add_col('reading_plans','plan_kind',
  "`plan_kind` ENUM('fixed','custom','lifetime') NOT NULL DEFAULT 'fixed'");
CALL w4_add_col('reading_plans','base_price_30',
  '`base_price_30` DECIMAL(12,2) NULL');
CALL w4_add_col('subscriptions','plan_kind',
  "`plan_kind` ENUM('fixed','custom','lifetime') NOT NULL DEFAULT 'fixed'");
UPDATE reading_plans SET base_price_30=price WHERE base_price_30 IS NULL;
ALTER TABLE reading_plans MODIFY COLUMN base_price_30 DECIMAL(12,2) NOT NULL;
DROP PROCEDURE w4_add_col;
SELECT id,name,plan_kind,price,base_price_30,duration_days FROM reading_plans ORDER BY id;
