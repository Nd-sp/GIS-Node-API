-- =========================================
-- Auto-Cleanup for Expired Temporary Access
-- =========================================
-- This script creates a MySQL event that automatically
-- removes expired temporary access from user_regions table
-- =========================================

USE opticonnectgis_db;

-- Enable event scheduler (run once)
SET GLOBAL event_scheduler = ON;

-- Drop existing event if it exists
DROP EVENT IF EXISTS cleanup_expired_temporary_access;

-- Create event to run every 5 minutes for frequent cleanup
DELIMITER $$

CREATE EVENT cleanup_expired_temporary_access
ON SCHEDULE EVERY 5 MINUTE
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  -- Remove expired temporary access from user_regions
  -- Only remove if the access was granted temporarily (has a matching entry in temporary_access)
  DELETE ur FROM user_regions ur
  INNER JOIN temporary_access ta ON ur.user_id = ta.user_id AND ur.region_id = ta.resource_id
  WHERE ta.resource_type = 'region'
    AND ta.revoked_at IS NULL
    AND ta.expires_at <= UTC_TIMESTAMP()
    AND NOT EXISTS (
      -- Don't remove if user has another active temporary access to the same region
      SELECT 1 FROM temporary_access ta2
      WHERE ta2.user_id = ur.user_id
        AND ta2.resource_id = ur.region_id
        AND ta2.resource_type = 'region'
        AND ta2.revoked_at IS NULL
        AND ta2.expires_at > UTC_TIMESTAMP()
    );

  -- Mark expired temporary_access entries as inactive
  UPDATE temporary_access
  SET revoked_at = UTC_TIMESTAMP(),
      revoked_by = NULL
  WHERE revoked_at IS NULL
    AND expires_at <= UTC_TIMESTAMP()
    AND resource_type = 'region';

  -- Log cleanup activity (optional - for debugging)
  -- Uncomment if you have an event_logs table
  -- INSERT INTO event_logs (event_type, message, created_at)
  -- VALUES ('TEMP_ACCESS_CLEANUP', CONCAT('Cleaned up ', ROW_COUNT(), ' expired temporary access entries'), UTC_TIMESTAMP());
END$$

DELIMITER ;

-- Verify event was created
SELECT
  event_name,
  event_definition,
  interval_value,
  interval_field,
  status,
  last_executed
FROM information_schema.events
WHERE event_schema = 'opticonnectgis_db'
  AND event_name = 'cleanup_expired_temporary_access';

SELECT '✅ Auto-cleanup event created successfully! Runs every 24 hours.' as Status;
