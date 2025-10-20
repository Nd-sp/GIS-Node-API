-- =========================================
-- Fix MySQL Timezone Configuration
-- =========================================
-- This script sets MySQL to use UTC timezone
-- to prevent time mismatch issues
-- =========================================

-- Check current timezone settings
SELECT @@global.time_zone, @@session.time_zone;

-- Set global timezone to UTC
SET GLOBAL time_zone = '+00:00';

-- Set session timezone to UTC
SET time_zone = '+00:00';

-- Verify the change
SELECT NOW() as 'Current MySQL Time (UTC)',
       UTC_TIMESTAMP() as 'UTC Timestamp',
       CONVERT_TZ(NOW(), '+00:00', '+05:30') as 'IST Time';

-- Update existing temporary_access records to UTC if needed
-- (Only if they were stored in local time)
-- UPDATE temporary_access
-- SET expires_at = CONVERT_TZ(expires_at, '+05:30', '+00:00')
-- WHERE expires_at > '2025-01-01';

SELECT '✅ MySQL timezone set to UTC. Restart MySQL service for global changes to persist.' as Status;
