-- ==================================================
-- Fix temporary_access Table Schema
-- ==================================================
-- Issue: Code expects columns that don't exist in the schema
-- Solution: Add missing columns to temporary_access table
-- ==================================================

USE opticonnectgis_db;

-- Add missing columns to temporary_access table
ALTER TABLE `temporary_access`
  ADD COLUMN IF NOT EXISTS `granted_by` INT AFTER `access_level`,
  ADD COLUMN IF NOT EXISTS `granted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `granted_by`,
  ADD COLUMN IF NOT EXISTS `reason` TEXT AFTER `granted_at`,
  ADD COLUMN IF NOT EXISTS `revoked_at` TIMESTAMP NULL AFTER `expires_at`,
  ADD FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- Verify changes
SELECT '✅ temporary_access table updated with missing columns' as Status;

SHOW COLUMNS FROM `temporary_access`;
