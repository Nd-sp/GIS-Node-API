-- ============================================================================
-- LOS Analysis Migration - Fix Script
-- Fix the remaining issues from the initial migration
-- ============================================================================

USE opticonnect_gis;

-- Step 1: Add missing columns to elevation_profiles (excluding is_saved which already exists)
ALTER TABLE elevation_profiles
ADD COLUMN building_data JSON DEFAULT NULL COMMENT 'Building data along path from OSM',
ADD COLUMN obstacle_data JSON DEFAULT NULL COMMENT 'Obstacle data (trees, towers, poles) along path',
ADD COLUMN los_analysis JSON DEFAULT NULL COMMENT 'Line-of-sight analysis results including Fresnel zones',
ADD COLUMN antenna_height_1 DECIMAL(10,2) DEFAULT 30.00 COMMENT 'Start point antenna height in meters',
ADD COLUMN antenna_height_2 DECIMAL(10,2) DEFAULT 30.00 COMMENT 'End point antenna height in meters',
ADD COLUMN rf_frequency DECIMAL(10,2) DEFAULT 2400.00 COMMENT 'RF frequency in MHz for Fresnel zone calculation',
ADD COLUMN points JSON DEFAULT NULL COMMENT 'Multi-point path waypoints for complex routes';

-- Step 2: Add indexes for the new columns
ALTER TABLE elevation_profiles
ADD INDEX idx_antenna_heights (antenna_height_1, antenna_height_2),
ADD INDEX idx_rf_frequency (rf_frequency),
ADD INDEX idx_is_saved (is_saved);

-- Step 3: Verify columns were added
SELECT
  CONCAT('✓ elevation_profiles has ', COUNT(*), ' LOS-related columns') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'elevation_profiles'
  AND COLUMN_NAME IN ('building_data', 'obstacle_data', 'los_analysis',
                      'antenna_height_1', 'antenna_height_2', 'rf_frequency', 'points');

-- Step 4: Verify indexes were added
SELECT
  CONCAT('✓ Found ', COUNT(*), ' LOS-related indexes') AS Status
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'elevation_profiles'
  AND INDEX_NAME IN ('idx_antenna_heights', 'idx_rf_frequency', 'idx_is_saved');

SELECT '✅ LOS Migration Fix Completed Successfully!' AS Status;
