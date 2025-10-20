-- ==============================================
-- OptiConnect - New Tables and Schema Alignment
-- Date: 2025-10-11
-- ==============================================

-- Use your database
USE opticonnectgis_db;

-- 1) Region Requests (per provided schema)
CREATE TABLE IF NOT EXISTS region_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  region_id INT NOT NULL,
  request_type ENUM('access', 'modification', 'creation') NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  review_notes TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- 2) Audit Logs (per provided schema)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INT,
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- 3) Analytics Metrics (per provided schema)
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  metric_type VARCHAR(100) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(15, 2),
  dimension JSON,
  region_id INT NULL,
  user_id INT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_metric_type (metric_type),
  INDEX idx_recorded_at (recorded_at)
);

-- 4) Temporary Access (inferred from controller usage)
-- Grants temporary access to resources (currently resource_type='region')
CREATE TABLE IF NOT EXISTS temporary_access (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id INT NOT NULL,
  access_level ENUM('read','write','admin') DEFAULT 'read',
  reason TEXT,
  granted_by INT NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_by INT NULL,
  revoked_at DATETIME NULL,
  UNIQUE KEY uniq_user_resource_active (user_id, resource_type, resource_id, granted_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 5) Minor alignment: ensure user_regions supports access_level, expires_at if needed
ALTER TABLE user_regions
  ADD COLUMN IF NOT EXISTS access_level ENUM('read','write','admin') DEFAULT 'read' AFTER region_id,
  ADD COLUMN IF NOT EXISTS assigned_by INT NULL AFTER access_level,
  ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL AFTER assigned_by,
  ADD INDEX IF NOT EXISTS idx_user_region (user_id, region_id);

SELECT '✅ New tables created/verified successfully' AS status;
