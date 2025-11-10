-- Add reverse_bearing column to elevation_profiles table
-- This stores the bearing from Point B to Point A (reverse direction)

USE opticonnectgis_db;

-- Check if column exists and add it if it doesn't
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'opticonnectgis_db'
    AND TABLE_NAME = 'elevation_profiles'
    AND COLUMN_NAME = 'reverse_bearing'
);

SET @query = IF(@col_exists = 0,
    'ALTER TABLE elevation_profiles ADD COLUMN reverse_bearing DECIMAL(6,2) DEFAULT NULL COMMENT ''Bearing angle from Point B to Point A (0-360 degrees)'' AFTER bearing',
    'SELECT ''Column reverse_bearing already exists'' AS message'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
