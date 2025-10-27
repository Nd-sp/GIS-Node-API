-- Migration: Create user_map_preference and search_history tables
-- Description: Tables to store user map preferences and search history
-- Date: 2025-01-25

-- Table: user_map_preference
-- Stores user-specific map settings and preferences
CREATE TABLE IF NOT EXISTS user_map_preference (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,

  -- Map View Preferences
  default_center_lat DECIMAL(10, 8) DEFAULT 20.5937,
  default_center_lng DECIMAL(11, 8) DEFAULT 78.9629,
  default_zoom INT DEFAULT 5,
  default_map_type VARCHAR(20) DEFAULT 'roadmap', -- roadmap, satellite, hybrid, terrain

  -- Boundary Settings
  boundary_enabled BOOLEAN DEFAULT true,
  boundary_color VARCHAR(7) DEFAULT '#3B82F6',
  boundary_opacity DECIMAL(3, 2) DEFAULT 0.5,
  boundary_dim_when_tool_active BOOLEAN DEFAULT true,
  boundary_dimmed_opacity DECIMAL(3, 2) DEFAULT 0.2,

  -- Layer Visibility Preferences
  layer_distance_visible BOOLEAN DEFAULT false,
  layer_polygon_visible BOOLEAN DEFAULT false,
  layer_circle_visible BOOLEAN DEFAULT false,
  layer_elevation_visible BOOLEAN DEFAULT false,
  layer_infrastructure_visible BOOLEAN DEFAULT false,
  layer_sector_visible BOOLEAN DEFAULT false,

  -- User Filter Preference (for admin/manager)
  default_user_filter VARCHAR(10) DEFAULT 'me', -- 'me', 'all', 'user'

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign Key
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Unique constraint: one preference per user
  UNIQUE KEY unique_user_preference (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: search_history
-- Stores user search history for GlobalSearch
CREATE TABLE IF NOT EXISTS search_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,

  -- Search Details
  query VARCHAR(255) NOT NULL,
  search_type VARCHAR(50) NOT NULL, -- 'place', 'coordinates', 'savedData'

  -- Result Information (JSON)
  result_type VARCHAR(50), -- 'Infrastructure', 'Distance', 'Elevation', 'Polygon', etc.
  result_id INT, -- ID of the saved data item (if applicable)
  result_name VARCHAR(255),
  result_location JSON, -- {lat, lng}

  -- Metadata
  results_count INT DEFAULT 0,
  clicked BOOLEAN DEFAULT false, -- Whether user clicked on this search result

  -- Timestamps
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Key
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Indexes for better performance
  INDEX idx_user_searches (user_id, searched_at DESC),
  INDEX idx_search_query (query),
  INDEX idx_search_type (search_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for better query performance
CREATE INDEX idx_user_map_preference_user ON user_map_preference(user_id);
CREATE INDEX idx_search_history_user_recent ON search_history(user_id, searched_at DESC);
