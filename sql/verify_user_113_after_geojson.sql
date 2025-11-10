-- Verify user 113's data after accurate GeoJSON assignment

-- 1. Which regions is user 113 assigned to?
SELECT r.id, r.name
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
WHERE ur.user_id = 113;

-- 2. How many items in each of their assigned regions?
SELECT
    r.name as region_name,
    COUNT(i.id) as item_count
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
LEFT JOIN infrastructure_items i ON i.region_id = r.id
WHERE ur.user_id = 113
GROUP BY r.id, r.name
ORDER BY item_count DESC;

-- 3. Sample of items user 113 should see
SELECT
    i.id,
    i.item_name,
    i.latitude,
    i.longitude,
    r.name as region_name
FROM infrastructure_items i
JOIN regions r ON i.region_id = r.id
WHERE i.region_id IN (
    SELECT region_id FROM user_regions WHERE user_id = 113
)
LIMIT 20;
