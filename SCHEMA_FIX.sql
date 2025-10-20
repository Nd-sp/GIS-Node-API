-- ==================================================
-- OptiConnect Backend - Schema Fixes
-- Run this BEFORE testing APIs
-- ==================================================
-- Description: Fixes mismatches between database schema
--              and API controller implementations
-- Date: 2025-01-08
-- ==================================================

USE opticonnectgis_db;

-- ==================================================
-- CRITICAL FIX 1: Rename table usergroup_members to group_members
-- ==================================================
-- Issue: Controllers use 'group_members' but schema has 'usergroup_members'
-- Solution: Rename table to match controller expectations

RENAME TABLE IF EXISTS `usergroup_members` TO `group_members`;

SELECT '✅ Fix 1 Complete: Table renamed to group_members' as Status;

-- ==================================================
-- CRITICAL FIX 2: Update groups table structure
-- ==================================================
-- Issue 1: Schema has 'created_by' but controller uses 'owner_id'
-- Issue 2: Controller expects 'is_public' field which doesn't exist
-- Solution: Rename column and add missing field

-- Rename created_by to owner_id
ALTER TABLE `groups`
  CHANGE COLUMN `created_by` `owner_id` INT;

-- Add is_public column
ALTER TABLE `groups`
  ADD COLUMN IF NOT EXISTS `is_public` BOOLEAN DEFAULT false AFTER `is_active`;

SELECT '✅ Fix 2 Complete: groups table updated (owner_id, is_public added)' as Status;

-- ==================================================
-- CRITICAL FIX 3: Update gis_features table structure
-- ==================================================
-- Issue 1: Schema has 'geometry_geojson' but controller uses 'geometry'
-- Issue 2: Controller uses 'tags' field which doesn't exist in schema
-- Solution: Rename column and add missing field

-- Rename geometry_geojson to geometry
ALTER TABLE `gis_features`
  CHANGE COLUMN `geometry_geojson` `geometry` TEXT;

-- Add tags column
ALTER TABLE `gis_features`
  ADD COLUMN IF NOT EXISTS `tags` JSON AFTER `properties`;

SELECT '✅ Fix 3 Complete: gis_features table updated (geometry, tags added)' as Status;

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Verify groups table structure
SELECT '
========================================
VERIFICATION: groups table
========================================' as '';

SHOW COLUMNS FROM `groups`;

-- Verify table rename worked
SELECT '
========================================
VERIFICATION: group_members table exists
========================================' as '';

SHOW TABLES LIKE '%group%';

-- Verify gis_features table structure
SELECT '
========================================
VERIFICATION: gis_features table
========================================' as '';

SHOW COLUMNS FROM `gis_features`;

-- Final status
SELECT '
========================================
✅ ALL SCHEMA FIXES COMPLETED SUCCESSFULLY!
========================================

Next Steps:
1. Verify above table structures
2. Test APIs with Thunder Client
3. Check API documentation

' as 'Final Status';
