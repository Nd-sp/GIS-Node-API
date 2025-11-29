-- Migration: Add Region Boundary Management Tables
-- Date: 2025-11-15
-- Description: Create tables for storing editable region boundaries with version history and audit trail

-- Drop tables if they exist (for clean re-run)
DROP TABLE IF EXISTS boundary_change_history;
DROP TABLE IF EXISTS region_boundaries;

-- ============================================
-- Table: region_boundaries
-- Purpose: Store GeoJSON boundaries for regions with versioning
-- ============================================
CREATE TABLE region_boundaries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_id INT NOT NULL,
  boundary_geojson JSON NOT NULL COMMENT 'GeoJSON geometry (Polygon or MultiPolygon)',
  boundary_type ENUM('Polygon', 'MultiPolygon') NOT NULL DEFAULT 'Polygon',
  version INT NOT NULL DEFAULT 1 COMMENT 'Version number for this boundary',
  vertex_count INT COMMENT 'Total number of vertices for quick reference',
  area_sqkm DECIMAL(12, 4) COMMENT 'Approximate area in square kilometers',

  -- Metadata
  created_by INT NOT NULL COMMENT 'User ID who created/uploaded this boundary',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Only one active boundary per region',

  -- Additional info
  source VARCHAR(100) COMMENT 'Source of boundary data (e.g., "Manual Edit", "GeoJSON Import", "Survey Data")',
  notes TEXT COMMENT 'Any additional notes about this boundary version',

  -- Foreign keys
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

  -- Indexes
  INDEX idx_region_active (region_id, is_active),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stores editable region boundaries with version control';

-- ============================================
-- Table: boundary_change_history
-- Purpose: Audit trail for all boundary modifications
-- ============================================
CREATE TABLE boundary_change_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_id INT NOT NULL,
  boundary_id INT COMMENT 'Reference to region_boundaries.id',

  -- Change tracking
  old_boundary JSON COMMENT 'Previous boundary GeoJSON (before change)',
  new_boundary JSON COMMENT 'New boundary GeoJSON (after change)',
  old_version INT COMMENT 'Previous version number',
  new_version INT COMMENT 'New version number',

  -- Change metadata
  change_type ENUM('created', 'edited', 'imported', 'reverted', 'deleted') NOT NULL,
  change_reason VARCHAR(500) COMMENT 'Reason for boundary change',
  vertices_added INT DEFAULT 0 COMMENT 'Number of vertices added',
  vertices_removed INT DEFAULT 0 COMMENT 'Number of vertices removed',
  vertices_moved INT DEFAULT 0 COMMENT 'Number of vertices moved',

  -- User and system info
  changed_by INT NOT NULL COMMENT 'User ID who made the change',
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) COMMENT 'IP address of user who made change',
  user_agent TEXT COMMENT 'Browser user agent',

  -- Foreign keys
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (boundary_id) REFERENCES region_boundaries(id) ON DELETE SET NULL,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,

  -- Indexes
  INDEX idx_region_history (region_id, changed_at),
  INDEX idx_changed_by (changed_by),
  INDEX idx_change_type (change_type),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit trail for region boundary changes';

-- ============================================
-- Insert sample boundaries (optional)
-- ============================================

-- Example: Add a simple boundary for a region (if regions table has data)
-- This is just a placeholder - actual GeoJSON should be loaded from files

-- INSERT INTO region_boundaries (region_id, boundary_geojson, boundary_type, created_by, source, notes)
-- SELECT
--   r.id,
--   JSON_OBJECT(
--     'type', 'Polygon',
--     'coordinates', JSON_ARRAY(
--       JSON_ARRAY(
--         JSON_ARRAY(72.0, 19.0),
--         JSON_ARRAY(73.0, 19.0),
--         JSON_ARRAY(73.0, 20.0),
--         JSON_ARRAY(72.0, 20.0),
--         JSON_ARRAY(72.0, 19.0)
--       )
--     )
--   ) as boundary_geojson,
--   'Polygon',
--   1, -- Assuming admin user ID is 1
--   'Initial Import',
--   'Default boundary - needs manual editing'
-- FROM regions r
-- WHERE r.type = 'state'
-- LIMIT 5;

-- ============================================
-- Verification Queries
-- ============================================

-- Check tables created
SELECT
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'opticonnectgis_db'
  AND TABLE_NAME IN ('region_boundaries', 'boundary_change_history')
ORDER BY TABLE_NAME;

-- Check table structure
DESCRIBE region_boundaries;
DESCRIBE boundary_change_history;

-- ============================================
-- Rollback Script (if needed)
-- ============================================
-- To rollback this migration:
-- DROP TABLE IF EXISTS boundary_change_history;
-- DROP TABLE IF EXISTS region_boundaries;
