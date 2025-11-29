-- Migration: Add region_id column to all GIS tool tables
-- Date: 2025-11-26
-- Description: Add region_id column to polygon_drawings, circle_drawings, and elevation_profiles tables

-- Add region_id to polygon_drawings if it doesn't exist
ALTER TABLE polygon_drawings
ADD COLUMN IF NOT EXISTS region_id INT NULL AFTER user_id,
ADD INDEX IF NOT EXISTS idx_region_id (region_id),
ADD CONSTRAINT IF NOT EXISTS fk_polygon_region
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Add region_id to circle_drawings if it doesn't exist
ALTER TABLE circle_drawings
ADD COLUMN IF NOT EXISTS region_id INT NULL AFTER user_id,
ADD INDEX IF NOT EXISTS idx_region_id (region_id),
ADD CONSTRAINT IF NOT EXISTS fk_circle_region
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Add region_id to elevation_profiles if it doesn't exist
ALTER TABLE elevation_profiles
ADD COLUMN IF NOT EXISTS region_id INT NULL AFTER user_id,
ADD INDEX IF NOT EXISTS idx_region_id (region_id),
ADD CONSTRAINT IF NOT EXISTS fk_elevation_region
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Add region_id to distance_measurements if it doesn't exist
ALTER TABLE distance_measurements
ADD COLUMN IF NOT EXISTS region_id INT NULL AFTER user_id,
ADD INDEX IF NOT EXISTS idx_region_id (region_id),
ADD CONSTRAINT IF NOT EXISTS fk_distance_region
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Add region_id to sector_rf if table exists
SET @table_exists = (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = 'opticonnectgis_db' AND table_name = 'sector_rf');

SET @sql = IF(@table_exists > 0,
  'ALTER TABLE sector_rf
   ADD COLUMN IF NOT EXISTS region_id INT NULL AFTER user_id,
   ADD INDEX IF NOT EXISTS idx_region_id (region_id),
   ADD CONSTRAINT IF NOT EXISTS fk_sector_region
     FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;',
  'SELECT "sector_rf table does not exist" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 020 completed successfully' AS status;
