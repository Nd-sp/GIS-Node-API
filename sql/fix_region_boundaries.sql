-- Fix incorrect region assignments
-- The previous script had overlapping boundaries causing Telangana items to be marked as Maharashtra

-- First, let's see the damage
SELECT
    r.name as region_name,
    COUNT(*) as incorrect_items
FROM infrastructure_items i
JOIN regions r ON i.region_id = r.id
WHERE (
    -- Items marked as Maharashtra but coordinates are in Telangana
    (r.name = 'Maharashtra' AND i.latitude BETWEEN 15.0 AND 19.5 AND i.longitude BETWEEN 77.0 AND 81.5)
    -- Items marked as Maharashtra but coordinates are in Karnataka
    OR (r.name = 'Maharashtra' AND i.latitude BETWEEN 11.5 AND 18.5 AND i.longitude BETWEEN 74.0 AND 78.5)
)
GROUP BY r.name;

-- Now fix with accurate boundaries
UPDATE infrastructure_items i
SET region_id = CASE
    -- Andhra Pradesh (corrected)
    WHEN i.latitude BETWEEN 12.6 AND 19.9 AND i.longitude BETWEEN 76.8 AND 84.8 THEN
        (SELECT id FROM regions WHERE name = 'Andhra Pradesh' LIMIT 1)

    -- Telangana (NEW - was being assigned to Maharashtra)
    WHEN i.latitude BETWEEN 15.9 AND 19.9 AND i.longitude BETWEEN 77.2 AND 81.3 THEN
        (SELECT id FROM regions WHERE name = 'Telangana' LIMIT 1)

    -- Maharashtra (FIXED - reduced eastern boundary to not include Telangana)
    WHEN i.latitude BETWEEN 15.6 AND 22.0 AND i.longitude BETWEEN 72.6 AND 77.0 THEN
        (SELECT id FROM regions WHERE name = 'Maharashtra' LIMIT 1)

    -- Karnataka (corrected)
    WHEN i.latitude BETWEEN 11.5 AND 18.5 AND i.longitude BETWEEN 74.0 AND 78.5 THEN
        (SELECT id FROM regions WHERE name = 'Karnataka' LIMIT 1)

    -- Gujarat
    WHEN i.latitude BETWEEN 20.1 AND 24.7 AND i.longitude BETWEEN 68.2 AND 74.5 THEN
        (SELECT id FROM regions WHERE name = 'Gujarat' LIMIT 1)

    -- Madhya Pradesh
    WHEN i.latitude BETWEEN 21.1 AND 26.9 AND i.longitude BETWEEN 74.0 AND 82.8 THEN
        (SELECT id FROM regions WHERE name = 'Madhya Pradesh' LIMIT 1)

    -- Tamil Nadu
    WHEN i.latitude BETWEEN 8.1 AND 13.6 AND i.longitude BETWEEN 76.2 AND 80.3 THEN
        (SELECT id FROM regions WHERE name = 'Tamil Nadu' LIMIT 1)

    -- Kerala
    WHEN i.latitude BETWEEN 8.2 AND 12.8 AND i.longitude BETWEEN 74.8 AND 77.4 THEN
        (SELECT id FROM regions WHERE name = 'Kerala' LIMIT 1)

    -- Rajasthan
    WHEN i.latitude BETWEEN 23.0 AND 30.2 AND i.longitude BETWEEN 69.5 AND 78.3 THEN
        (SELECT id FROM regions WHERE name = 'Rajasthan' LIMIT 1)

    -- Delhi NCR
    WHEN i.latitude BETWEEN 28.4 AND 28.9 AND i.longitude BETWEEN 76.8 AND 77.3 THEN
        (SELECT id FROM regions WHERE name = 'Delhi NCR' LIMIT 1)

    -- Uttar Pradesh
    WHEN i.latitude BETWEEN 23.9 AND 30.4 AND i.longitude BETWEEN 77.1 AND 84.6 THEN
        (SELECT id FROM regions WHERE name = 'Uttar Pradesh' LIMIT 1)

    -- West Bengal
    WHEN i.latitude BETWEEN 21.5 AND 27.2 AND i.longitude BETWEEN 85.8 AND 89.9 THEN
        (SELECT id FROM regions WHERE name = 'West Bengal' LIMIT 1)

    ELSE i.region_id  -- Keep existing if no match
END
WHERE i.region_id IS NOT NULL;

-- Verify the fix
SELECT
    r.name as region_name,
    COUNT(*) as item_count
FROM infrastructure_items i
JOIN regions r ON i.region_id = r.id
WHERE i.latitude BETWEEN 15.0 AND 19.0
  AND i.longitude BETWEEN 77.0 AND 81.0
GROUP BY r.name
ORDER BY item_count DESC;

-- Show what user 113 should now see
SELECT
    r.name as region_name,
    COUNT(i.id) as item_count
FROM user_regions ur
JOIN regions r ON ur.region_id = r.id
LEFT JOIN infrastructure_items i ON i.region_id = r.id
WHERE ur.user_id = 113
GROUP BY r.id, r.name;
