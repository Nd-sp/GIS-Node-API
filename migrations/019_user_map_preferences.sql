-- Migration: Create user_map_preferences table
-- Date: 2025-11-21
-- Description: User map preferences and settings storage

USE opticonnectgis_db;

-- Create user_map_preferences table
CREATE TABLE IF NOT EXISTS user_map_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  default_map_type VARCHAR(50) DEFAULT 'satellite',
  default_zoom INT DEFAULT 10,
  default_center JSON DEFAULT NULL,
  default_region_id INT DEFAULT NULL,
  theme VARCHAR(20) DEFAULT 'auto',
  measurement_unit VARCHAR(20) DEFAULT 'metric',
  show_coordinates BOOLEAN DEFAULT TRUE,
  show_scale BOOLEAN DEFAULT TRUE,
  auto_save_enabled BOOLEAN DEFAULT TRUE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  preferences JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (default_region_id) REFERENCES regions(id) ON DELETE SET NULL,
  UNIQUE KEY unique_user_preferences (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for faster lookups
CREATE INDEX idx_user_map_preferences_user_id ON user_map_preferences(user_id);

SELECT '✅ user_map_preferences table created successfully' AS status;
