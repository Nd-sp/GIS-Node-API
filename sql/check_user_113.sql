-- Check user 113's assigned regions
SELECT
    u.id,
    u.username,
    u.email,
    u.role,
    GROUP_CONCAT(r.name) as assigned_regions,
    COUNT(r.id) as region_count
FROM users u
LEFT JOIN user_regions ur ON u.id = ur.user_id
LEFT JOIN regions r ON ur.region_id = r.id
WHERE u.id = 113
GROUP BY u.id;

-- Check what the subquery returns for user 113
SELECT region_id FROM user_regions WHERE user_id = 113;

-- Check all regions
SELECT id, name FROM regions WHERE is_active = TRUE ORDER BY name;

-- Test the exact query that backend uses
SELECT COUNT(*) as filtered_count
FROM infrastructure_items i
WHERE i.latitude BETWEEN 13.978838277689796 AND 26.933815539297754
  AND i.longitude BETWEEN 67.32837851562499 AND 90.59742148437499
  AND (
    i.region_id IN (
      SELECT region_id FROM user_regions WHERE user_id = 113
      UNION
      SELECT resource_id FROM temporary_access
      WHERE user_id = 113 AND resource_type = 'region'
      AND expires_at > NOW() AND revoked_at IS NULL
    )
  );
