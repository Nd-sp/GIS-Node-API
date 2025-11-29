-- ============================================
-- Groups and Permissions System Migration
-- Version: 017
-- Date: 2025-11-19
-- Description: Complete groups and permissions tables
-- ============================================

-- ============================================
-- 1. GROUPS TABLE (Enhanced)
-- ============================================
-- Check if groups table exists, if not create it
CREATE TABLE IF NOT EXISTS `groups` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add is_active column if it doesn't exist
SET @dbname = 'opticonnectgis_db';
SET @tablename = 'groups';
SET @columnname = 'is_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = @tablename
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` BOOLEAN DEFAULT TRUE AFTER description')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 2. GROUP_MEMBERS TABLE (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member') DEFAULT 'member',
  added_by INT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_membership (group_id, user_id),
  INDEX idx_user (user_id),
  INDEX idx_group (group_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add role column if it doesn't exist
SET @columnname = 'role';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
    AND TABLE_NAME = 'group_members'
    AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT 1',
  'ALTER TABLE group_members ADD COLUMN `role` ENUM(''owner'', ''admin'', ''member'') DEFAULT ''member'' AFTER user_id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 3. USER_PERMISSIONS TABLE (NEW)
-- Direct permissions assigned to individual users
-- ============================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  permission_id VARCHAR(100) NOT NULL,
  granted_by INT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_user_permission (user_id, permission_id),
  INDEX idx_user (user_id),
  INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. GROUP_PERMISSIONS TABLE (NEW)
-- Permissions assigned to groups (inherited by members)
-- ============================================
CREATE TABLE IF NOT EXISTS group_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  permission_id VARCHAR(100) NOT NULL,
  granted_by INT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_group_permission (group_id, permission_id),
  INDEX idx_group (group_id),
  INDEX idx_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. GROUP_REGIONS TABLE (NEW)
-- Regions assigned to groups (inherited by members)
-- ============================================
CREATE TABLE IF NOT EXISTS group_regions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  group_id INT NOT NULL,
  region_id INT NOT NULL,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_group_region (group_id, region_id),
  INDEX idx_group (group_id),
  INDEX idx_region (region_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. Insert Sample Groups (if table is empty)
-- ============================================
INSERT INTO `groups` (name, description, created_by, is_active)
SELECT 'Field Engineers', 'Default group for field engineers', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM `groups` WHERE name = 'Field Engineers');

INSERT INTO `groups` (name, description, created_by, is_active)
SELECT 'Data Analysts', 'Default group for data analysts', 1, TRUE
WHERE NOT EXISTS (SELECT 1 FROM `groups` WHERE name = 'Data Analysts');

-- ============================================
-- Migration Complete
-- ============================================
SELECT 'Groups and Permissions system migration completed successfully!' AS Status;
