-- Final verification for user 113 after accurate GeoJSON assignment

-- User 113's assigned regions
SELECT 'User 113 Regions:' as info, GROUP_CONCAT(r.name) as regions
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
WHERE ur.user_id = 113;

-- Items count per region for user 113
SELECT
    r.name as region_name,
    COUNT(i.id) as item_count
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
LEFT JOIN infrastructure_items i ON i.region_id = r.id
WHERE ur.user_id = 113
GROUP BY r.id, r.name
ORDER BY item_count DESC;

-- Total items user 113 should see
SELECT 'Total for User 113:' as info, COUNT(*) as total_items
FROM infrastructure_items i
WHERE i.region_id IN (
    SELECT region_id FROM user_regions WHERE user_id = 113
);

-- Sample items from Maharashtra (should be ONLY Maharashtra, no Telangana)
SELECT
    i.id,
    i.item_name,
    i.latitude,
    i.longitude,
    r.name as region_name
FROM infrastructure_items i
JOIN regions r ON i.region_id = r.id
WHERE i.region_id = (SELECT id FROM regions WHERE name = 'Maharashtra')
ORDER BY i.id
LIMIT 10;

-- Sample items from Telangana (should NOT be visible to user 113)
SELECT
    'These should NOT be visible to user 113:' as warning,
    COUNT(*) as telangana_items
FROM infrastructure_items i
WHERE i.region_id = (SELECT id FROM regions WHERE name = 'Telangana');
