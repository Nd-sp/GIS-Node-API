-- Show which 2 regions user 113 is assigned to
SELECT r.id, r.name
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
WHERE ur.user_id = 113;

-- Count items by region for those 2 assigned regions
SELECT
    r.name as region_name,
    COUNT(i.id) as item_count
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
LEFT JOIN infrastructure_items i ON i.region_id = r.id
WHERE ur.user_id = 113
GROUP BY r.id, r.name;

-- Check if there are items with NULL region_id being returned
SELECT
    COALESCE(r.name, 'NULL/No Region') as region_name,
    COUNT(*) as count
FROM infrastructure_items i
LEFT JOIN regions r ON i.region_id = r.id
WHERE i.latitude BETWEEN 13.978838277689796 AND 26.933815539297754
  AND i.longitude BETWEEN 67.32837851562499 AND 90.59742148437499
  AND (
    i.region_id IN (
      SELECT region_id FROM user_regions WHERE user_id = 113
    )
    OR i.region_id IS NULL  -- Check if NULL items are being included
  )
GROUP BY r.name
ORDER BY count DESC;

-- Check sample items that ARE being returned with their regions
SELECT
    i.id,
    i.item_name,
    i.latitude,
    i.longitude,
    i.region_id,
    r.name as region_name
FROM infrastructure_items i
LEFT JOIN regions r ON i.region_id = r.id
WHERE i.latitude BETWEEN 13.978838277689796 AND 26.933815539297754
  AND i.longitude BETWEEN 67.32837851562499 AND 90.59742148437499
  AND i.region_id IN (
    SELECT region_id FROM user_regions WHERE user_id = 113
  )
LIMIT 20;
