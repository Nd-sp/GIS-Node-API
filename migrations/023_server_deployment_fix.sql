-- ================================================
-- Server Deployment Fix - Missing Tables
-- File: 023_server_deployment_fix.sql
-- Date: 2025-12-01
-- Description: Adds missing sector_rf_data table for production server
-- ================================================

USE opticonnectgis_db;

-- Create sector_rf_data table (used by DataHub controller)
-- This is an alias/extended version of sector_rf table
CREATE TABLE IF NOT EXISTS sector_rf_data (
  id INT PRIMARY KEY AUTO_INCREMENT,
  
  -- Sector Geometry
  center_lat DECIMAL(10,8) NOT NULL,
  center_lng DECIMAL(11,8) NOT NULL,
  radius_meters DECIMAL(12,2) NOT NULL,
  start_angle DECIMAL(5,2) NOT NULL,        -- 0-360 degrees
  end_angle DECIMAL(5,2) NOT NULL,          -- 0-360 degrees
  
  -- Styling
  fill_color VARCHAR(7) DEFAULT '#00FF00',  -- Hex color
  stroke_color VARCHAR(7) DEFAULT '#000000',
  opacity DECIMAL(3,2) DEFAULT 0.50,
  stroke_weight INT DEFAULT 2,
  
  -- Metadata
  name VARCHAR(255),
  description TEXT,
  site_name VARCHAR(255),
  antenna_type VARCHAR(100),
  frequency_mhz DECIMAL(10,2),
  power_dbm DECIMAL(6,2),
  azimuth DECIMAL(5,2),                     -- Antenna direction
  
  -- Data Management
  region_id INT,
  user_id INT NOT NULL,                     -- Owner (matches DataHub query)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  INDEX idx_user (user_id),
  INDEX idx_region (region_id),
  INDEX idx_created_at (created_at),
  INDEX idx_location (center_lat, center_lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing data from sector_rf to sector_rf_data (if sector_rf has data)
INSERT INTO sector_rf_data (center_lat, center_lng, radius_meters, start_angle, end_angle, fill_color, stroke_color, name, user_id, created_at)
SELECT 
  center_lat, 
  center_lng, 
  radius_meters, 
  start_angle, 
  end_angle, 
  fill_color, 
  stroke_color, 
  name,
  created_by as user_id,
  created_at
FROM sector_rf
WHERE NOT EXISTS (SELECT 1 FROM sector_rf_data);

-- ================================================
-- Verification Queries
-- ================================================

-- Check if tables exist
SELECT 
  'fiber_rings' as table_name,
  COUNT(*) as record_count
FROM fiber_rings
UNION ALL
SELECT 
  'sector_rf_data' as table_name,
  COUNT(*) as record_count
FROM sector_rf_data;

-- ================================================
-- End of Migration
-- ================================================
