-- ============================================
-- Nutrition Passport — Schema Migration
-- ============================================

-- 1. products 테이블 — 필드 추가
ALTER TABLE products
  ADD COLUMN front_image_url VARCHAR(500) DEFAULT NULL AFTER image_url,
  ADD COLUMN ingredient_image_url VARCHAR(500) DEFAULT NULL AFTER front_image_url,
  ADD COLUMN barcode_image_url VARCHAR(500) DEFAULT NULL AFTER ingredient_image_url,
  ADD COLUMN status ENUM('pending', 'verified') DEFAULT 'verified' AFTER barcode_image_url;

-- 2. pet_foods 테이블 — 신규
CREATE TABLE pet_foods (
  id VARCHAR(36) NOT NULL,
  pet_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) DEFAULT NULL,
  scan_id VARCHAR(36) DEFAULT NULL,
  product_name VARCHAR(300) NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  started_at DATE NOT NULL,
  ended_at DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_pet_foods_pet_id (pet_id),
  INDEX idx_pet_foods_is_current (pet_id, is_current),
  CONSTRAINT fk_pet_foods_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT fk_pet_foods_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_pet_foods_scan FOREIGN KEY (scan_id) REFERENCES scan_history(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. daily_checkins 테이블 — 신규
CREATE TABLE daily_checkins (
  id VARCHAR(36) NOT NULL,
  pet_id VARCHAR(36) NOT NULL,
  pet_food_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  stool_score TINYINT UNSIGNED DEFAULT NULL COMMENT '1~5',
  appetite ENUM('low', 'normal', 'high') DEFAULT NULL,
  vomiting BOOLEAN DEFAULT FALSE,
  itching BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkin_pet_date (pet_id, date),
  INDEX idx_checkins_pet_food (pet_food_id),
  CONSTRAINT fk_checkins_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkins_pet_food FOREIGN KEY (pet_food_id) REFERENCES pet_foods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
