-- ==============================================================================
-- Migration: Add Line-of-Sight Analysis Fields to elevation_profiles
-- ==============================================================================
-- Description: Adds building data, obstacle data, and LOS analysis fields
-- Created: 2025-01-03
-- ==============================================================================

USE opticonnect_gis;

-- Add new columns for LOS analysis to elevation_profiles table
ALTER TABLE elevation_profiles
ADD COLUMN building_data JSON DEFAULT NULL COMMENT 'Building data along path from OSM',
ADD COLUMN obstacle_data JSON DEFAULT NULL COMMENT 'Obstacle data (trees, towers, poles) along path',
ADD COLUMN los_analysis JSON DEFAULT NULL COMMENT 'Line-of-sight analysis results including Fresnel zones',
ADD COLUMN antenna_height_1 DECIMAL(10,2) DEFAULT 30.00 COMMENT 'Start point antenna height in meters',
ADD COLUMN antenna_height_2 DECIMAL(10,2) DEFAULT 30.00 COMMENT 'End point antenna height in meters',
ADD COLUMN rf_frequency DECIMAL(10,2) DEFAULT 2400.00 COMMENT 'RF frequency in MHz for Fresnel zone calculation',
ADD COLUMN is_saved BOOLEAN DEFAULT FALSE COMMENT 'Whether profile is saved or temporary',
ADD COLUMN points JSON DEFAULT NULL COMMENT 'Multi-point path waypoints for complex routes';

-- ==============================================================================
-- Create building_cache table for caching OSM building data
-- ==============================================================================
CREATE TABLE IF NOT EXISTS building_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL UNIQUE COMMENT 'Geographic bounds hash key',
  bbox_south DECIMAL(10, 7) NOT NULL COMMENT 'Bounding box south coordinate',
  bbox_north DECIMAL(10, 7) NOT NULL COMMENT 'Bounding box north coordinate',
  bbox_west DECIMAL(10, 7) NOT NULL COMMENT 'Bounding box west coordinate',
  bbox_east DECIMAL(10, 7) NOT NULL COMMENT 'Bounding box east coordinate',
  building_data JSON NOT NULL COMMENT 'Cached building data from OSM',
  obstacle_data JSON DEFAULT NULL COMMENT 'Cached obstacle data (trees, towers, etc.)',
  data_source ENUM('OSM', 'Google', 'Manual') DEFAULT 'OSM' COMMENT 'Source of the cached data',
  building_count INT DEFAULT 0 COMMENT 'Number of buildings in cache',
  buildings_with_height INT DEFAULT 0 COMMENT 'Number of buildings with actual height data',
  confidence_score DECIMAL(5, 2) DEFAULT 0.00 COMMENT 'Data confidence percentage (0-100)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 30 DAY) COMMENT 'Cache expiration (30 days)',
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  access_count INT DEFAULT 0 COMMENT 'Number of times this cache was accessed',

  INDEX idx_cache_key (cache_key),
  INDEX idx_bbox (bbox_south, bbox_north, bbox_west, bbox_east),
  INDEX idx_expires (expires_at),
  INDEX idx_created (created_at)
) ENGINE=InnoDB COMMENT='Cache for OSM building and obstacle data to reduce API calls';

-- ==============================================================================
-- Create manual_building_heights table for user-submitted corrections
-- ==============================================================================
CREATE TABLE IF NOT EXISTS manual_building_heights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  building_osm_id VARCHAR(50) DEFAULT NULL COMMENT 'OSM building ID if available',
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  height DECIMAL(10, 2) NOT NULL COMMENT 'Building height in meters',
  building_type VARCHAR(100) DEFAULT NULL COMMENT 'Type of building',
  building_name VARCHAR(255) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  verification_status ENUM('Pending', 'Verified', 'Rejected') DEFAULT 'Pending',
  verified_by INT DEFAULT NULL COMMENT 'Admin user who verified',
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_user (user_id),
  INDEX idx_location (latitude, longitude),
  INDEX idx_osm (building_osm_id),
  INDEX idx_status (verification_status)
) ENGINE=InnoDB COMMENT='User-submitted building heights for manual corrections';

-- ==============================================================================
-- Add indexes for better query performance
-- ==============================================================================
ALTER TABLE elevation_profiles
ADD INDEX idx_antenna_heights (antenna_height_1, antenna_height_2),
ADD INDEX idx_rf_frequency (rf_frequency),
ADD INDEX idx_is_saved (is_saved);

-- ==============================================================================
-- Verification
-- ==============================================================================
SELECT
  CONCAT('✓ Added ', COUNT(*), ' new columns to elevation_profiles table') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'elevation_profiles'
  AND COLUMN_NAME IN ('building_data', 'obstacle_data', 'los_analysis', 'antenna_height_1', 'antenna_height_2', 'rf_frequency', 'is_saved', 'points');

SELECT
  CONCAT('✓ Created building_cache table with ', COUNT(*), ' columns') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'building_cache';

SELECT
  CONCAT('✓ Created manual_building_heights table with ', COUNT(*), ' columns') AS Status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'manual_building_heights';

SELECT '✓ Migration completed successfully!' AS Status;
