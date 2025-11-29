-- ============================================
-- FIXED Migration: Region Boundary Management
-- Fixed: created_by and changed_by now allow NULL
-- ============================================

DROP TABLE IF EXISTS boundary_change_history;
DROP TABLE IF EXISTS region_boundaries;

-- ============================================
-- Table: region_boundaries
-- ============================================
CREATE TABLE region_boundaries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_id INT NOT NULL,
  boundary_geojson JSON NOT NULL,
  boundary_type ENUM('Polygon', 'MultiPolygon') NOT NULL DEFAULT 'Polygon',
  version INT NOT NULL DEFAULT 1,
  vertex_count INT,
  area_sqkm DECIMAL(12, 4),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  source VARCHAR(100),
  notes TEXT,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_region_active (region_id, is_active),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table: boundary_change_history
-- ============================================
CREATE TABLE boundary_change_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_id INT NOT NULL,
  boundary_id INT,
  old_boundary JSON,
  new_boundary JSON,
  old_version INT,
  new_version INT,
  change_type ENUM('created', 'edited', 'imported', 'reverted', 'deleted') NOT NULL,
  change_reason VARCHAR(500),
  vertices_added INT DEFAULT 0,
  vertices_removed INT DEFAULT 0,
  vertices_moved INT DEFAULT 0,
  changed_by INT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (boundary_id) REFERENCES region_boundaries(id) ON DELETE SET NULL,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_region_history (region_id, changed_at),
  INDEX idx_changed_by (changed_by),
  INDEX idx_change_type (change_type),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Verify Tables Created
-- ============================================
SELECT 'Tables created successfully!' as Status;
SHOW TABLES LIKE '%boundary%';
SELECT COUNT(*) as region_boundaries_count FROM region_boundaries;
SELECT COUNT(*) as boundary_change_history_count FROM boundary_change_history;
