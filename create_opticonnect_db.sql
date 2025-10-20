-- ==============================================
-- OptiConnect - Fresh Database Bootstrap Script
-- Database: opticonnect_db
-- Date: 2025-10-11
-- ==============================================

-- 0) Create database if not exists
CREATE DATABASE IF NOT EXISTS opticonnect_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE opticonnect_db;

-- 1) Core: users
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('Male','Female','Other') DEFAULT 'Other',
  role ENUM('admin','manager','engineer','viewer') DEFAULT 'viewer',
  phone VARCHAR(30),
  department VARCHAR(100),
  office_location VARCHAR(150),
  street VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  is_email_verified BOOLEAN DEFAULT FALSE,
  created_by INT NULL,
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- 2) Core: regions
CREATE TABLE IF NOT EXISTS regions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  type ENUM('state','district','city','custom') DEFAULT 'state',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
);

-- 3) Mapping: user_regions
CREATE TABLE IF NOT EXISTS user_regions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  region_id INT NOT NULL,
  access_level ENUM('read','write','admin') DEFAULT 'read',
  assigned_by INT NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_region (user_id, region_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_region_id (region_id)
);

-- 4) Groups
CREATE TABLE IF NOT EXISTS `groups` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  owner_id INT NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner','admin','member') DEFAULT 'member',
  added_by INT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_group_user (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5) Temporary access (resource-level, currently regions)
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_res (user_id, resource_type, resource_id),
  INDEX idx_expires (expires_at)
);

-- 6) Region requests (per your schema)
CREATE TABLE IF NOT EXISTS region_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  region_id INT NOT NULL,
  request_type ENUM('access','modification','creation') NOT NULL,
  reason TEXT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  review_notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- 7) Audit logs (per your schema)
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

-- 8) Analytics metrics (per your schema)
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  metric_type VARCHAR(100) NOT NULL,
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(15,2) DEFAULT 0,
  dimension JSON,
  region_id INT NULL,
  user_id INT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_metric_type (metric_type),
  INDEX idx_recorded_at (recorded_at)
);

-- Seed minimal admin user (optional, comment out if not needed)
-- INSERT INTO users (username, email, password_hash, full_name, role, is_active)
-- VALUES ('admin', 'admin@opticonnect.com', '$2a$10$abcdefghijklmnopqrstuv1234567890abcd', 'Admin User', 'admin', TRUE);

SELECT '✅ opticonnect_db created and core tables ready' AS status;
