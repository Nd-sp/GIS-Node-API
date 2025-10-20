-- =========================================
-- IMMEDIATE Cleanup for Expired Temporary Access
-- Run this manually in MySQL Workbench to clean up NOW
-- =========================================

USE opticonnectgis_db;

-- Show expired temporary access before cleanup
SELECT
  ta.id,
  ta.user_id,
  u.username,
  r.name as region_name,
  ta.expires_at,
  TIMESTAMPDIFF(MINUTE, ta.expires_at, UTC_TIMESTAMP()) as minutes_expired,
  ta.status
FROM temporary_access ta
LEFT JOIN users u ON ta.user_id = u.id
LEFT JOIN regions r ON ta.resource_id = r.id
WHERE ta.resource_type = 'region'
  AND ta.revoked_at IS NULL
  AND ta.expires_at <= UTC_TIMESTAMP();

-- Remove expired temporary access from user_regions
DELETE ur FROM user_regions ur
INNER JOIN temporary_access ta ON ur.user_id = ta.user_id AND ur.region_id = ta.resource_id
WHERE ta.resource_type = 'region'
  AND ta.revoked_at IS NULL
  AND ta.expires_at <= UTC_TIMESTAMP()
  AND NOT EXISTS (
    SELECT 1 FROM temporary_access ta2
    WHERE ta2.user_id = ur.user_id
      AND ta2.resource_id = ur.region_id
      AND ta2.resource_type = 'region'
      AND ta2.revoked_at IS NULL
      AND ta2.expires_at > UTC_TIMESTAMP()
  );

-- Mark expired temporary_access entries as revoked
UPDATE temporary_access
SET revoked_at = UTC_TIMESTAMP(),
    revoked_by = NULL,
    status = 'revoked'
WHERE revoked_at IS NULL
  AND expires_at <= UTC_TIMESTAMP()
  AND resource_type = 'region';

-- Show results after cleanup
SELECT
  CONCAT('✅ Cleaned up ',
    (SELECT COUNT(*) FROM temporary_access WHERE status = 'revoked' AND revoked_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)),
    ' expired temporary access entries'
  ) as cleanup_result;

-- Show currently active temporary access
SELECT
  ta.id,
  ta.user_id,
  u.username,
  r.name as region_name,
  ta.granted_at,
  ta.expires_at,
  TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), ta.expires_at) as seconds_remaining,
  ta.status
FROM temporary_access ta
LEFT JOIN users u ON ta.user_id = u.id
LEFT JOIN regions r ON ta.resource_id = r.id
WHERE ta.resource_type = 'region'
  AND ta.revoked_at IS NULL
  AND ta.expires_at > UTC_TIMESTAMP()
ORDER BY ta.expires_at ASC;
