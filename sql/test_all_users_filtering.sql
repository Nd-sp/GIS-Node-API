-- Test filtering for ALL users with region assignments
-- This shows how the GeoJSON fix benefits everyone

-- 1. Show all users with their assigned regions
SELECT
    u.id,
    u.username,
    u.email,
    u.role,
    GROUP_CONCAT(r.name ORDER BY r.name) as assigned_regions,
    COUNT(DISTINCT r.id) as region_count
FROM users u
LEFT JOIN user_regions ur ON u.id = ur.user_id
LEFT JOIN regions r ON ur.region_id = r.id
GROUP BY u.id, u.username, u.email, u.role
HAVING region_count > 0
ORDER BY u.username;

-- 2. Show how many items each user should see (based on their regions)
SELECT
    u.id as user_id,
    u.username,
    GROUP_CONCAT(DISTINCT r.name ORDER BY r.name) as their_regions,
    COUNT(DISTINCT i.id) as total_items_visible
FROM users u
JOIN user_regions ur ON u.id = ur.user_id
JOIN regions r ON ur.region_id = r.id
LEFT JOIN infrastructure_items i ON i.region_id = r.id
GROUP BY u.id, u.username
ORDER BY u.username;

-- 3. Example: Show what different users see
-- User 113 (Maharashtra + Rajasthan)
SELECT 'User 113 (Maharashtra + Rajasthan)' as user_case, COUNT(*) as items_visible
FROM infrastructure_items i
WHERE i.region_id IN (
    SELECT region_id FROM user_regions WHERE user_id = 113
);

-- Any user with Gujarat assigned
SELECT 'User with Gujarat' as user_case, COUNT(*) as items_visible
FROM infrastructure_items i
WHERE i.region_id = (SELECT id FROM regions WHERE name = 'Gujarat' LIMIT 1);

-- Any user with Telangana assigned (FIXED - no longer sees Maharashtra items!)
SELECT 'User with Telangana (FIXED!)' as user_case, COUNT(*) as items_visible
FROM infrastructure_items i
WHERE i.region_id = (SELECT id FROM regions WHERE name = 'Telangana' LIMIT 1);

-- 4. Show the fix in action: Items that MOVED from Maharashtra to Telangana
SELECT
    i.id,
    i.item_name,
    i.latitude,
    i.longitude,
    r.name as correct_region
FROM infrastructure_items i
JOIN regions r ON i.region_id = r.id
WHERE i.latitude BETWEEN 15.9 AND 19.9
  AND i.longitude BETWEEN 77.2 AND 81.3
  AND r.name = 'Telangana'  -- Now correctly in Telangana, not Maharashtra!
LIMIT 10;
