-- ============================================================================
-- LOS Analysis Migration - Final Version
-- Adds Line-of-Sight analysis capabilities to OptiConnect GIS
-- Safe to run - checks for existing columns
-- ============================================================================

USE opticonnect_gis;

-- Check which columns already exist
SET @col_building_data = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'building_data');
SET @col_obstacle_data = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'obstacle_data');
SET @col_los_analysis = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'los_analysis');
SET @col_antenna_height_1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'antenna_height_1');
SET @col_antenna_height_2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'antenna_height_2');
SET @col_rf_frequency = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'rf_frequency');
SET @col_points = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'points');

-- Add columns only if they don't exist
SET @sql_building_data = IF(@col_building_data = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN building_data JSON DEFAULT NULL COMMENT "Building data along path from OSM"',
  'SELECT "Column building_data already exists" AS Info');
PREPARE stmt FROM @sql_building_data;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_obstacle_data = IF(@col_obstacle_data = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN obstacle_data JSON DEFAULT NULL COMMENT "Obstacle data (trees, towers, poles) along path"',
  'SELECT "Column obstacle_data already exists" AS Info');
PREPARE stmt FROM @sql_obstacle_data;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_los_analysis = IF(@col_los_analysis = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN los_analysis JSON DEFAULT NULL COMMENT "Line-of-sight analysis results including Fresnel zones"',
  'SELECT "Column los_analysis already exists" AS Info');
PREPARE stmt FROM @sql_los_analysis;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_antenna_height_1 = IF(@col_antenna_height_1 = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN antenna_height_1 DECIMAL(10,2) DEFAULT 30.00 COMMENT "Start point antenna height in meters"',
  'SELECT "Column antenna_height_1 already exists" AS Info');
PREPARE stmt FROM @sql_antenna_height_1;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_antenna_height_2 = IF(@col_antenna_height_2 = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN antenna_height_2 DECIMAL(10,2) DEFAULT 30.00 COMMENT "End point antenna height in meters"',
  'SELECT "Column antenna_height_2 already exists" AS Info');
PREPARE stmt FROM @sql_antenna_height_2;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_rf_frequency = IF(@col_rf_frequency = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN rf_frequency DECIMAL(10,2) DEFAULT 2400.00 COMMENT "RF frequency in MHz for Fresnel zone calculation"',
  'SELECT "Column rf_frequency already exists" AS Info');
PREPARE stmt FROM @sql_rf_frequency;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_points = IF(@col_points = 0,
  'ALTER TABLE elevation_profiles ADD COLUMN points JSON DEFAULT NULL COMMENT "Multi-point path waypoints for complex routes"',
  'SELECT "Column points already exists" AS Info');
PREPARE stmt FROM @sql_points;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes (skip if they exist)
SET @idx_antenna = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND INDEX_NAME = 'idx_antenna_heights');
SET @idx_frequency = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND INDEX_NAME = 'idx_rf_frequency');
SET @idx_saved = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND INDEX_NAME = 'idx_is_saved');

SET @sql_idx_antenna = IF(@idx_antenna = 0 AND @col_antenna_height_1 > 0,
  'ALTER TABLE elevation_profiles ADD INDEX idx_antenna_heights (antenna_height_1, antenna_height_2)',
  'SELECT "Index idx_antenna_heights already exists or columns not ready" AS Info');
PREPARE stmt FROM @sql_idx_antenna;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql_idx_frequency = IF(@idx_frequency = 0 AND @col_rf_frequency > 0,
  'ALTER TABLE elevation_profiles ADD INDEX idx_rf_frequency (rf_frequency)',
  'SELECT "Index idx_rf_frequency already exists or column not ready" AS Info');
PREPARE stmt FROM @sql_idx_frequency;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_is_saved = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'opticonnect_gis' AND TABLE_NAME = 'elevation_profiles' AND COLUMN_NAME = 'is_saved');

SET @sql_idx_saved = IF(@idx_saved = 0 AND @col_is_saved > 0,
  'ALTER TABLE elevation_profiles ADD INDEX idx_is_saved (is_saved)',
  'SELECT "Index idx_is_saved already exists or column not ready" AS Info');
PREPARE stmt FROM @sql_idx_saved;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify columns were added
SELECT 'Verification Results:' AS '';
SELECT
  CONCAT('✓ elevation_profiles has ', COUNT(*), ' LOS-related columns') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'elevation_profiles'
  AND COLUMN_NAME IN ('building_data', 'obstacle_data', 'los_analysis',
                      'antenna_height_1', 'antenna_height_2', 'rf_frequency', 'points');

SELECT
  CONCAT('✓ Found ', COUNT(*), ' LOS-related indexes') AS Status
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'elevation_profiles'
  AND INDEX_NAME IN ('idx_antenna_heights', 'idx_rf_frequency', 'idx_is_saved');

SELECT
  CONCAT('✓ building_cache table has ', COUNT(*), ' columns') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'building_cache';

SELECT
  CONCAT('✓ manual_building_heights table has ', COUNT(*), ' columns') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'manual_building_heights';

SELECT '✅ LOS Analysis Migration Completed Successfully!' AS FinalStatus;
