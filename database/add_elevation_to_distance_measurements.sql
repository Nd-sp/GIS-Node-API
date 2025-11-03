-- ============================================================================
-- SQL SCRIPT: Add Elevation Data to Distance Measurements
-- ============================================================================
-- IMPORTANT: Execute this query manually on your company's database server
-- This adds elevation-related columns to the distance_measurements table
-- ============================================================================

-- Add elevation data columns to distance_measurements table
ALTER TABLE distance_measurements
ADD COLUMN elevation_data JSON COMMENT 'Array of elevation data points with lat, lng, elevation',
ADD COLUMN min_elevation DECIMAL(10, 2) COMMENT 'Minimum elevation in meters',
ADD COLUMN max_elevation DECIMAL(10, 2) COMMENT 'Maximum elevation in meters',
ADD COLUMN elevation_gain DECIMAL(10, 2) COMMENT 'Total elevation gain in meters',
ADD COLUMN elevation_loss DECIMAL(10, 2) COMMENT 'Total elevation loss in meters';

-- Verify the changes
DESCRIBE distance_measurements;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================
-- Uncomment and run the following lines if you need to rollback:
--
-- ALTER TABLE distance_measurements
-- DROP COLUMN elevation_data,
-- DROP COLUMN min_elevation,
-- DROP COLUMN max_elevation,
-- DROP COLUMN elevation_gain,
-- DROP COLUMN elevation_loss;
-- ============================================================================
