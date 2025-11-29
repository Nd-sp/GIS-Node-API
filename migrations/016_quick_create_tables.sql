-- Quick Table Creation (Without Data Migration)
-- Creates boundary_versions and infrastructure_region_history tables

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

  -- Impact Analysis Results
  impact_summary JSON,

  -- Constraints
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE RESTRICT,

  -- Indexes
  INDEX idx_region_status (region_id, status),
  INDEX idx_version_number (region_id, version_number),
  INDEX idx_created_by (created_by),
  INDEX idx_published_at (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS infrastructure_region_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  infrastructure_id INT NOT NULL,
  old_region_id INT,
  new_region_id INT,

  -- Version Information
  boundary_version_id INT NOT NULL,
  version_number INT NOT NULL,

  -- Change Details
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_reason VARCHAR(255),
  is_invalid BOOLEAN DEFAULT FALSE,

  -- Rollback Support
  can_rollback BOOLEAN DEFAULT TRUE,
  rollback_expires_at TIMESTAMP NULL,

  -- Constraints
  FOREIGN KEY (infrastructure_id) REFERENCES infrastructure_items(id) ON DELETE CASCADE,
  FOREIGN KEY (old_region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (new_region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (boundary_version_id) REFERENCES boundary_versions(id) ON DELETE RESTRICT,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT,

  -- Indexes
  INDEX idx_infrastructure_id (infrastructure_id),
  INDEX idx_boundary_version (boundary_version_id),
  INDEX idx_changed_at (changed_at),
  INDEX idx_rollback_expires (rollback_expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create trigger for single draft rule
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS enforce_single_draft_before_insert
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
      SET MESSAGE_TEXT = 'Only one draft boundary allowed per region';
    END IF;
  END IF;
END$$

DELIMITER ;

-- Add spatial index
CREATE INDEX IF NOT EXISTS idx_infrastructure_coords_region
ON infrastructure_items(region_id, latitude, longitude);
