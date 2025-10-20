-- ==========================================
-- Global Search Feature - Database Migration
-- Adds missing columns to support search functionality
-- SAFE TO RUN - Only adds columns, doesn't remove anything
-- ==========================================

USE opticonnectgis_db;

-- ==========================================
-- 1. DISTANCE MEASUREMENTS
-- ==========================================
ALTER TABLE distance_measurements
  ADD COLUMN IF NOT EXISTS measurement_name VARCHAR(255) NULL AFTER region_id,
  ADD COLUMN IF NOT EXISTS total_distance DECIMAL(18,6) NULL AFTER distance,
  ADD COLUMN IF NOT EXISTS points JSON NULL AFTER total_distance;

-- Copy existing 'distance' to 'total_distance' if not already done
UPDATE distance_measurements
SET total_distance = distance
WHERE total_distance IS NULL AND distance IS NOT NULL;

-- ==========================================
-- 2. POLYGON DRAWINGS
-- ==========================================
ALTER TABLE polygon_drawings
  ADD COLUMN IF NOT EXISTS polygon_name VARCHAR(255) NULL AFTER region_id,
  ADD COLUMN IF NOT EXISTS vertices JSON NULL AFTER polygon_name,
  ADD COLUMN IF NOT EXISTS area DECIMAL(18,6) NULL AFTER vertices,
  ADD COLUMN IF NOT EXISTS perimeter DECIMAL(18,6) NULL AFTER area;

-- Copy existing 'name' to 'polygon_name' if not already done
UPDATE polygon_drawings
SET polygon_name = name
WHERE polygon_name IS NULL AND name IS NOT NULL;

-- ==========================================
-- 3. CIRCLE DRAWINGS
-- ==========================================
ALTER TABLE circle_drawings
  ADD COLUMN IF NOT EXISTS circle_name VARCHAR(255) NULL AFTER region_id,
  ADD COLUMN IF NOT EXISTS center JSON NULL AFTER circle_name,
  ADD COLUMN IF NOT EXISTS radius DECIMAL(18,6) NULL AFTER center,
  ADD COLUMN IF NOT EXISTS area DECIMAL(18,6) NULL AFTER radius;

-- Copy existing 'name' to 'circle_name' if not already done
UPDATE circle_drawings
SET circle_name = name
WHERE circle_name IS NULL AND name IS NOT NULL;

-- ==========================================
-- 4. SECTOR RF DATA
-- ==========================================
ALTER TABLE sector_rf_data
  ADD COLUMN IF NOT EXISTS sector_name VARCHAR(255) NULL AFTER region_id,
  ADD COLUMN IF NOT EXISTS center JSON NULL AFTER sector_name,
  ADD COLUMN IF NOT EXISTS radius DECIMAL(18,6) NULL AFTER center,
  ADD COLUMN IF NOT EXISTS start_angle DECIMAL(6,2) NULL AFTER radius,
  ADD COLUMN IF NOT EXISTS end_angle DECIMAL(6,2) NULL AFTER start_angle;

-- ==========================================
-- 5. ELEVATION PROFILES (NEW TABLE)
-- ==========================================
CREATE TABLE IF NOT EXISTS elevation_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  region_id INT NULL,
  profile_name VARCHAR(255) NULL,
  points JSON NULL,
  max_elevation DECIMAL(10,2) NULL,
  min_elevation DECIMAL(10,2) NULL,
  total_distance DECIMAL(18,6) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_region (region_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- 6. SEARCH HISTORY (NEW TABLE)
-- ==========================================
CREATE TABLE IF NOT EXISTS search_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  query VARCHAR(500) NOT NULL,
  result_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
SELECT 'Migration completed successfully! All search columns added.' AS status;
