-- Migration: Boundary Versioning System (Draft/Published Workflow)
-- Date: 2025-11-15
-- Description: Implements Draft/Published versioning for region boundaries with impact analysis and data migration support

-- ============================================
-- 1. Create boundary_versions table
-- ============================================
-- This table manages Draft/Published versions of boundaries
-- Only ONE draft allowed per region at a time

CREATE TABLE IF NOT EXISTS boundary_versions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_id INT NOT NULL,
  boundary_geojson JSON NOT NULL,
  boundary_type ENUM('Polygon', 'MultiPolygon') NOT NULL,
  vertex_count INT NOT NULL,
  area_sqkm DECIMAL(12, 4),

  -- Version Management
  version_number INT NOT NULL DEFAULT 1,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',

  -- Metadata
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_by INT,
  published_at TIMESTAMP NULL,
  notes TEXT,
  change_reason TEXT,
  source VARCHAR(100) DEFAULT 'Manual Edit',

  -- Impact Analysis Results (stored when publishing)
  impact_summary JSON COMMENT 'Stores impact analysis results: {totalAffected, regionChanges, invalidItems, affectedUsers}',

  -- Constraints
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT,

  -- Note: Single draft rule enforced by trigger 'enforce_single_draft_before_insert'
  -- (UNIQUE constraint removed to allow multiple published/archived versions)

  -- Index for quick lookups
  INDEX idx_region_status (region_id, status),
  INDEX idx_version_number (region_id, version_number),
  INDEX idx_created_by (created_by),
  INDEX idx_published_at (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 2. Create infrastructure_region_history table
-- ============================================
-- Tracks infrastructure region changes when boundaries are published
-- Enables rollback and audit trail

CREATE TABLE IF NOT EXISTS infrastructure_region_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  infrastructure_id INT NOT NULL,
  old_region_id INT,
  new_region_id INT,

  -- Version Information
  boundary_version_id INT NOT NULL COMMENT 'Links to boundary_versions.id that caused this change',
  version_number INT NOT NULL,

  -- Change Details
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_reason VARCHAR(255),
  is_invalid BOOLEAN DEFAULT FALSE COMMENT 'TRUE if item is outside all boundaries',

  -- Rollback Support
  can_rollback BOOLEAN DEFAULT TRUE,
  rollback_expires_at TIMESTAMP NULL COMMENT '30 days after publishing',

  -- Constraints
  FOREIGN KEY (infrastructure_id) REFERENCES infrastructure_items(id) ON DELETE CASCADE,
  FOREIGN KEY (old_region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (new_region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (boundary_version_id) REFERENCES boundary_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT,

  -- Indexes for performance
  INDEX idx_infrastructure_id (infrastructure_id),
  INDEX idx_boundary_version (boundary_version_id),
  INDEX idx_changed_at (changed_at),
  INDEX idx_rollback_expires (rollback_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- 3. Migrate existing boundaries to new system
-- ============================================
-- Move all current boundaries from region_boundaries to boundary_versions as 'published'

INSERT INTO boundary_versions (
  region_id,
  boundary_geojson,
  boundary_type,
  vertex_count,
  area_sqkm,
  version_number,
  status,
  created_by,
  created_at,
  published_by,
  published_at,
  notes,
  source
)
SELECT
  rb.region_id,
  rb.boundary_geojson,
  rb.boundary_type,
  rb.vertex_count,
  rb.area_sqkm,
  rb.version AS version_number,
  'published' AS status,
  rb.created_by,
  rb.created_at,
  rb.created_by AS published_by,
  rb.created_at AS published_at,
  rb.notes,
  rb.source
FROM region_boundaries rb
WHERE rb.is_active = TRUE;


-- ============================================
-- 4. Add new columns to region_boundaries (backward compatibility)
-- ============================================
-- Keep region_boundaries for legacy support, add reference to new system

ALTER TABLE region_boundaries
ADD COLUMN version_id INT COMMENT 'References boundary_versions.id' AFTER id,
ADD COLUMN is_published BOOLEAN DEFAULT TRUE AFTER is_active,
ADD FOREIGN KEY (version_id) REFERENCES boundary_versions(id) ON DELETE SET NULL;

-- Link existing boundaries to migrated versions
UPDATE region_boundaries rb
INNER JOIN boundary_versions bv ON rb.region_id = bv.region_id
  AND rb.version = bv.version_number
  AND bv.status = 'published'
SET rb.version_id = bv.id,
    rb.is_published = TRUE
WHERE rb.is_active = TRUE;


-- ============================================
-- 5. Create stored procedure for impact analysis
-- ============================================
-- Analyzes impact of publishing a draft boundary

DELIMITER $$

CREATE PROCEDURE analyze_boundary_impact(
  IN p_region_id INT,
  IN p_draft_version_id INT
)
BEGIN
  DECLARE v_boundary_geojson JSON;

  -- Get draft boundary
  SELECT boundary_geojson INTO v_boundary_geojson
  FROM boundary_versions
  WHERE id = p_draft_version_id AND region_id = p_region_id AND status = 'draft';

  -- Return impact analysis
  SELECT
    -- Total affected items
    COUNT(*) as total_affected,

    -- Items that will move to this region
    SUM(CASE
      WHEN ST_Within(
        POINT(ii.longitude, ii.latitude),
        ST_GeomFromGeoJSON(v_boundary_geojson)
      ) AND ii.region_id != p_region_id THEN 1
      ELSE 0
    END) as items_moving_in,

    -- Items that will leave this region
    SUM(CASE
      WHEN NOT ST_Within(
        POINT(ii.longitude, ii.latitude),
        ST_GeomFromGeoJSON(v_boundary_geojson)
      ) AND ii.region_id = p_region_id THEN 1
      ELSE 0
    END) as items_moving_out,

    -- Items that will become invalid (outside all boundaries)
    SUM(CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM boundary_versions bv2
        WHERE bv2.status = 'published'
        AND bv2.region_id != p_region_id
        AND ST_Within(
          POINT(ii.longitude, ii.latitude),
          ST_GeomFromGeoJSON(bv2.boundary_geojson)
        )
      ) AND NOT ST_Within(
        POINT(ii.longitude, ii.latitude),
        ST_GeomFromGeoJSON(v_boundary_geojson)
      ) AND ii.region_id = p_region_id THEN 1
      ELSE 0
    END) as items_becoming_invalid

  FROM infrastructure_items ii
  WHERE ii.region_id = p_region_id OR EXISTS (
    SELECT 1 WHERE ST_Within(
      POINT(ii.longitude, ii.latitude),
      ST_GeomFromGeoJSON(v_boundary_geojson)
    )
  );
END$$

DELIMITER ;


-- ============================================
-- 6. Create trigger to enforce single draft rule
-- ============================================
-- Ensures only ONE draft exists per region

DELIMITER $$

CREATE TRIGGER enforce_single_draft_before_insert
BEFORE INSERT ON boundary_versions
FOR EACH ROW
BEGIN
  DECLARE draft_count INT;

  IF NEW.status = 'draft' THEN
    SELECT COUNT(*) INTO draft_count
    FROM boundary_versions
    WHERE region_id = NEW.region_id AND status = 'draft';

    IF draft_count > 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only one draft boundary allowed per region. Please publish or discard the existing draft first.';
    END IF;
  END IF;
END$$

DELIMITER ;


-- ============================================
-- 7. Add indexes for spatial queries
-- ============================================
-- Optimize ST_Within() queries for impact analysis

-- Already indexed: infrastructure_items.latitude, infrastructure_items.longitude
-- Already indexed: infrastructure_items.region_id

-- Add composite index for faster spatial lookups
CREATE INDEX idx_infrastructure_coords_region
ON infrastructure_items(region_id, latitude, longitude);


-- ============================================
-- 8. Grant permissions (if needed)
-- ============================================
-- Ensure application user has necessary permissions
-- (Modify username as per your setup)

-- GRANT SELECT, INSERT, UPDATE, DELETE ON boundary_versions TO 'root'@'localhost';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON infrastructure_region_history TO 'root'@'localhost';
-- GRANT EXECUTE ON PROCEDURE analyze_boundary_impact TO 'root'@'localhost';


-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Summary:
-- ✅ Created boundary_versions table (Draft/Published workflow)
-- ✅ Created infrastructure_region_history table (audit trail)
-- ✅ Migrated existing boundaries to new system
-- ✅ Added backward compatibility columns
-- ✅ Created impact analysis stored procedure
-- ✅ Added trigger to enforce single draft rule
-- ✅ Optimized spatial query indexes
--
-- Next Steps:
-- 1. Run this migration: mysql -u root -pKarma@1107 opticonnectgis_db < 016_boundary_versioning_system.sql
-- 2. Verify tables: SHOW TABLES LIKE 'boundary%';
-- 3. Check migrated data: SELECT * FROM boundary_versions WHERE status = 'published';
