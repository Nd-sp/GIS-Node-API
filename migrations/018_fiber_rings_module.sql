-- ================================================
-- Fiber Ring Module - Database Migration
-- File: 018_fiber_rings_module.sql
-- Date: 2025-11-19
-- Description: Creates tables for Fiber Ring Management
-- ================================================

-- Table 1: fiber_rings (Main fiber ring routes)
CREATE TABLE IF NOT EXISTS fiber_rings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Geometry
  coordinates JSON NOT NULL,              -- Array of {lat, lng} objects
  total_length_km DECIMAL(10,2),          -- Calculated total length

  -- Fiber Details
  fiber_type ENUM('Single-mode', 'Multi-mode', 'Hybrid') DEFAULT 'Single-mode',
  fiber_count INT,                        -- Number of fibers (e.g., 24, 48, 96)
  capacity_gbps INT,                      -- Total capacity in Gbps

  -- Style
  line_color VARCHAR(7) DEFAULT '#FF0000', -- Hex color (#RRGGBB)
  line_width INT DEFAULT 2,               -- Thickness in pixels (1-10)
  line_opacity DECIMAL(3,2) DEFAULT 1.00, -- 0.00 to 1.00
  line_dash_pattern VARCHAR(50),          -- e.g., 'solid', '5,5', '10,5,2,5'

  -- Metadata
  owner VARCHAR(255),                     -- Company/department owning the ring
  operator VARCHAR(255),                  -- Company operating/maintaining
  vendor VARCHAR(255),                    -- Installation vendor
  status ENUM('Planned', 'Under Construction', 'Active', 'Maintenance', 'Decommissioned') DEFAULT 'Planned',
  installation_date DATE,
  cost_inr DECIMAL(15,2),                 -- Installation cost in INR

  -- Data Management
  is_temporary BOOLEAN DEFAULT FALSE,     -- Temporary (session-only) or permanent
  region_id INT,                          -- Associated region
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_status (status),
  INDEX idx_region (region_id),
  INDEX idx_temporary (is_temporary),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at),
  FULLTEXT idx_search (name, description, owner, operator)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: fiber_ring_sites (Sites/locations along the ring)
CREATE TABLE IF NOT EXISTS fiber_ring_sites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ring_id INT NOT NULL,
  site_name VARCHAR(255) NOT NULL,
  site_type ENUM('POP', 'Customer', 'Junction', 'Repeater') DEFAULT 'Customer',

  -- Location
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  address TEXT,

  -- Icon
  icon_type VARCHAR(50) DEFAULT 'pushpin',    -- pushpin, target, building, tower, etc.
  icon_color VARCHAR(7) DEFAULT '#FFFF00',    -- Hex color
  icon_size INT DEFAULT 32,                   -- Pixels (16-64)

  -- Metadata
  infrastructure_item_id INT,                 -- Link to infrastructure_items table
  equipment_details JSON,                     -- Equipment installed at site
  power_requirement_kw DECIMAL(8,2),
  access_notes TEXT,

  -- Ordering
  sequence_order INT,                         -- Order of site along ring (0-based)
  distance_from_start_km DECIMAL(10,2),       -- Distance from ring start

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (ring_id) REFERENCES fiber_rings(id) ON DELETE CASCADE,
  FOREIGN KEY (infrastructure_item_id) REFERENCES infrastructure_items(id) ON DELETE SET NULL,

  INDEX idx_ring (ring_id),
  INDEX idx_site_type (site_type),
  INDEX idx_sequence (ring_id, sequence_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: fiber_ring_segments (Segments between sites)
CREATE TABLE IF NOT EXISTS fiber_ring_segments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ring_id INT NOT NULL,
  start_site_id INT NOT NULL,
  end_site_id INT NOT NULL,

  -- Segment Details
  length_km DECIMAL(10,2) NOT NULL,
  fiber_in_use INT DEFAULT 0,                 -- Fibers currently utilized
  available_capacity_gbps INT,

  -- Status
  status ENUM('Active', 'Degraded', 'Failed', 'Maintenance') DEFAULT 'Active',
  last_tested_at TIMESTAMP,
  next_maintenance_at DATE,

  -- Path
  segment_coordinates JSON,                   -- Detailed path between sites

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (ring_id) REFERENCES fiber_rings(id) ON DELETE CASCADE,
  FOREIGN KEY (start_site_id) REFERENCES fiber_ring_sites(id) ON DELETE CASCADE,
  FOREIGN KEY (end_site_id) REFERENCES fiber_ring_sites(id) ON DELETE CASCADE,

  INDEX idx_ring (ring_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 4: fiber_ring_history (Audit trail for changes)
CREATE TABLE IF NOT EXISTS fiber_ring_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ring_id INT NOT NULL,
  action ENUM('created', 'updated', 'deleted', 'imported', 'exported') NOT NULL,
  changed_by INT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  old_values JSON,                            -- Previous state
  new_values JSON,                            -- New state
  change_description TEXT,

  FOREIGN KEY (ring_id) REFERENCES fiber_rings(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_ring (ring_id),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Sample Data (Optional - for testing)
-- ================================================

-- Sample Ring: ATMA to SEARS RING-1
-- INSERT INTO fiber_rings (name, description, coordinates, fiber_type, fiber_count, capacity_gbps, line_color, status, owner, created_by) VALUES
-- (
--   'ATMA to SEARS RING-1',
--   'Primary fiber ring connecting ATMA POP to SEARS POP with 5 customer sites',
--   '[{"lat": 23.03330, "lng": 72.57086}, {"lat": 23.03369, "lng": 72.57020}, {"lat": 23.03571, "lng": 72.55950}, {"lat": 23.03257, "lng": 72.55801}, {"lat": 23.03253, "lng": 72.55478}, {"lat": 23.03147, "lng": 72.56329}, {"lat": 23.03496, "lng": 72.56049}, {"lat": 23.02555, "lng": 72.55425}]',
--   'Single-mode',
--   48,
--   100,
--   '#FF0000',
--   'Active',
--   'OptiConnect Networks',
--   1
-- );

-- Sample Sites
-- INSERT INTO fiber_ring_sites (ring_id, site_name, site_type, latitude, longitude, icon_type, icon_color, sequence_order) VALUES
-- (1, 'ATMA-POP', 'POP', 23.03330, 72.57088, 'target', '#FF0000', 0),
-- (1, 'Universal Sompo General Insurance', 'Customer', 23.03571, 72.55950, 'pushpin', '#FFFF00', 1),
-- (1, 'Federal Bank - Navrangpura', 'Customer', 23.03257, 72.55801, 'pushpin', '#FFFF00', 2),
-- (1, 'HDFC - Zodiac Square', 'Customer', 23.03253, 72.55478, 'pushpin', '#FFFF00', 3),
-- (1, 'Standard Chartered Bank', 'Customer', 23.03147, 72.56329, 'pushpin', '#FFFF00', 4),
-- (1, 'Shriram General Insurance', 'Customer', 23.03496, 72.56049, 'pushpin', '#FFFF00', 5),
-- (1, 'SEARS-POP', 'POP', 23.02555, 72.55425, 'target', '#FF0000', 6);

-- ================================================
-- End of Migration
-- ================================================
