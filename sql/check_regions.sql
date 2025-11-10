-- Check User Region Assignments
SELECT
    u.id,
    u.username,
    u.role,
    GROUP_CONCAT(r.name) as assigned_regions,
    COUNT(r.id) as region_count
FROM users u
LEFT JOIN user_regions ur ON u.id = ur.user_id
LEFT JOIN regions r ON ur.region_id = r.id
GROUP BY u.id
ORDER BY u.role, u.username;

-- Check Infrastructure Distribution by Region
SELECT
    COALESCE(r.name, 'No Region') as region_name,
    COUNT(i.id) as item_count,
    ROUND(COUNT(i.id) / (SELECT COUNT(*) FROM infrastructure_items) * 100, 2) as percentage
FROM infrastructure_items i
LEFT JOIN regions r ON i.region_id = r.id
GROUP BY r.id, r.name
ORDER BY item_count DESC;

-- Check Sample Infrastructure Items with Regions
SELECT
    i.id,
    i.item_name,
    i.item_type,
    i.user_id,
    r.name as region_name,
    i.latitude,
    i.longitude
FROM infrastructure_items i
LEFT JOIN regions r ON i.region_id = r.id
LIMIT 20;
