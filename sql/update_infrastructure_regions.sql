-- =====================================================================
-- Update Infrastructure Items with Region IDs
-- =====================================================================
-- Purpose: Populate region_id for all infrastructure items based on coordinates
-- This fixes the region filtering issue where items show up for all users
--
-- Run this script once to backfill region_id for existing data
-- =====================================================================

USE opticonnectgis_db;

-- Step 1: Create a function to detect region from coordinates
-- This function uses point-in-polygon matching with state boundaries
DELIMITER $$

DROP FUNCTION IF EXISTS detect_region_from_coords$$

CREATE FUNCTION detect_region_from_coords(lat DECIMAL(10,8), lng DECIMAL(11,8))
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE region_id INT DEFAULT NULL;

    -- First try: Use spatial index if geometry column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'opticonnectgis'
        AND TABLE_NAME = 'regions'
        AND COLUMN_NAME = 'geometry'
    ) THEN
        SELECT r.id INTO region_id
        FROM regions r
        WHERE ST_Contains(
            r.geometry,
            ST_GeomFromText(CONCAT('POINT(', lng, ' ', lat, ')'), 4326)
        )
        LIMIT 1;
    END IF;

    -- Fallback: Simple state name matching based on approximate boundaries
    -- This is a simplified approach - you should have proper geometry data
    IF region_id IS NULL THEN
        SELECT r.id INTO region_id
        FROM regions r
        WHERE r.name = CASE
            -- Maharashtra boundaries (approx)
            WHEN lat BETWEEN 15.6 AND 22.0 AND lng BETWEEN 72.6 AND 80.9 THEN 'Maharashtra'
            -- Rajasthan boundaries (approx)
            WHEN lat BETWEEN 23.0 AND 30.2 AND lng BETWEEN 69.5 AND 78.3 THEN 'Rajasthan'
            -- Gujarat boundaries (approx)
            WHEN lat BETWEEN 20.1 AND 24.7 AND lng BETWEEN 68.2 AND 74.5 THEN 'Gujarat'
            -- Karnataka boundaries (approx)
            WHEN lat BETWEEN 11.5 AND 18.5 AND lng BETWEEN 74.0 AND 78.6 THEN 'Karnataka'
            -- Tamil Nadu boundaries (approx)
            WHEN lat BETWEEN 8.0 AND 13.6 AND lng BETWEEN 76.2 AND 80.3 THEN 'Tamil Nadu'
            -- Uttar Pradesh boundaries (approx)
            WHEN lat BETWEEN 23.9 AND 30.4 AND lng BETWEEN 77.1 AND 84.6 THEN 'Uttar Pradesh'
            -- West Bengal boundaries (approx)
            WHEN lat BETWEEN 21.5 AND 27.2 AND lng BETWEEN 85.8 AND 89.9 THEN 'West Bengal'
            -- Madhya Pradesh boundaries (approx)
            WHEN lat BETWEEN 21.1 AND 26.9 AND lng BETWEEN 74.0 AND 82.8 THEN 'Madhya Pradesh'
            -- Andhra Pradesh boundaries (approx)
            WHEN lat BETWEEN 12.6 AND 19.9 AND lng BETWEEN 76.8 AND 84.8 THEN 'Andhra Pradesh'
            -- Telangana boundaries (approx)
            WHEN lat BETWEEN 15.8 AND 19.9 AND lng BETWEEN 77.2 AND 81.3 THEN 'Telangana'
            -- Kerala boundaries (approx)
            WHEN lat BETWEEN 8.2 AND 12.8 AND lng BETWEEN 74.8 AND 77.4 THEN 'Kerala'
            -- Punjab boundaries (approx)
            WHEN lat BETWEEN 29.5 AND 32.6 AND lng BETWEEN 73.9 AND 76.9 THEN 'Punjab'
            -- Haryana boundaries (approx)
            WHEN lat BETWEEN 27.7 AND 30.9 AND lng BETWEEN 74.5 AND 77.6 THEN 'Haryana'
            -- Bihar boundaries (approx)
            WHEN lat BETWEEN 24.3 AND 27.5 AND lng BETWEEN 83.3 AND 88.3 THEN 'Bihar'
            -- Odisha boundaries (approx)
            WHEN lat BETWEEN 17.8 AND 22.6 AND lng BETWEEN 81.3 AND 87.5 THEN 'Odisha'
            -- Jharkhand boundaries (approx)
            WHEN lat BETWEEN 21.9 AND 25.3 AND lng BETWEEN 83.3 AND 87.9 THEN 'Jharkhand'
            -- Assam boundaries (approx)
            WHEN lat BETWEEN 24.1 AND 28.2 AND lng BETWEEN 89.7 AND 96.0 THEN 'Assam'
            -- Chhattisgarh boundaries (approx)
            WHEN lat BETWEEN 17.8 AND 24.1 AND lng BETWEEN 80.3 AND 84.4 THEN 'Chhattisgarh'
            -- Goa boundaries (approx)
            WHEN lat BETWEEN 14.9 AND 15.8 AND lng BETWEEN 73.7 AND 74.4 THEN 'Goa'
            -- Himachal Pradesh boundaries (approx)
            WHEN lat BETWEEN 30.4 AND 33.3 AND lng BETWEEN 75.6 AND 79.0 THEN 'Himachal Pradesh'
            -- Uttarakhand boundaries (approx)
            WHEN lat BETWEEN 28.7 AND 31.5 AND lng BETWEEN 77.6 AND 81.0 THEN 'Uttarakhand'
            -- Jammu and Kashmir boundaries (approx)
            WHEN lat BETWEEN 32.3 AND 37.1 AND lng BETWEEN 73.3 AND 80.3 THEN 'Jammu and Kashmir'
            -- Delhi boundaries (approx)
            WHEN lat BETWEEN 28.4 AND 28.9 AND lng BETWEEN 76.8 AND 77.3 THEN 'Delhi'
            ELSE NULL
        END
        LIMIT 1;
    END IF;

    RETURN region_id;
END$$

DELIMITER ;

-- Step 2: Report current status
SELECT
    COUNT(*) as total_items,
    COUNT(region_id) as items_with_region,
    COUNT(*) - COUNT(region_id) as items_without_region,
    ROUND(COUNT(region_id) / COUNT(*) * 100, 2) as percentage_with_region
FROM infrastructure_items;

-- Step 3: Show items with invalid coordinates (outside India)
SELECT
    id,
    item_name,
    latitude,
    longitude,
    region_id,
    CONCAT(
        'Distance from nearest valid point: ',
        CASE
            WHEN latitude < 6.5 OR latitude > 35.5 OR longitude < 68.0 OR longitude > 97.5 THEN 'Outside India bounds'
            ELSE 'Within India bounds'
        END
    ) as validation_status
FROM infrastructure_items
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND (
    latitude < 6.5 OR latitude > 35.5 OR
    longitude < 68.0 OR longitude > 97.5
  )
ORDER BY id
LIMIT 50;

-- Step 4: Update region_id for all items with valid coordinates
UPDATE infrastructure_items
SET region_id = detect_region_from_coords(latitude, longitude)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND region_id IS NULL
  AND latitude BETWEEN 6.5 AND 35.5
  AND longitude BETWEEN 68.0 AND 97.5;

-- Step 5: Report updated status
SELECT
    COUNT(*) as total_items,
    COUNT(region_id) as items_with_region,
    COUNT(*) - COUNT(region_id) as items_without_region,
    ROUND(COUNT(region_id) / COUNT(*) * 100, 2) as percentage_with_region
FROM infrastructure_items;

-- Step 6: Show region distribution
SELECT
    COALESCE(r.name, 'Unassigned') as region_name,
    COUNT(i.id) as item_count,
    ROUND(COUNT(i.id) / (SELECT COUNT(*) FROM infrastructure_items) * 100, 2) as percentage
FROM infrastructure_items i
LEFT JOIN regions r ON i.region_id = r.id
GROUP BY r.name
ORDER BY item_count DESC;

-- Step 7: Items still without region (for manual review)
SELECT
    i.id,
    i.item_name,
    i.latitude,
    i.longitude,
    i.address_state,
    i.source,
    i.created_at
FROM infrastructure_items i
WHERE i.region_id IS NULL
  AND i.latitude IS NOT NULL
  AND i.longitude IS NOT NULL
ORDER BY i.created_at DESC
LIMIT 100;

-- =====================================================================
-- Maintenance: Create trigger to auto-assign region_id on INSERT/UPDATE
-- =====================================================================

DELIMITER $$

DROP TRIGGER IF EXISTS before_infrastructure_insert$$

CREATE TRIGGER before_infrastructure_insert
BEFORE INSERT ON infrastructure_items
FOR EACH ROW
BEGIN
    -- Auto-detect region if coordinates are provided
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL AND NEW.region_id IS NULL THEN
        SET NEW.region_id = detect_region_from_coords(NEW.latitude, NEW.longitude);
    END IF;
END$$

DROP TRIGGER IF EXISTS before_infrastructure_update$$

CREATE TRIGGER before_infrastructure_update
BEFORE UPDATE ON infrastructure_items
FOR EACH ROW
BEGIN
    -- Auto-detect region if coordinates changed
    IF (NEW.latitude != OLD.latitude OR NEW.longitude != OLD.longitude) AND NEW.region_id IS NULL THEN
        SET NEW.region_id = detect_region_from_coords(NEW.latitude, NEW.longitude);
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- Verification Queries
-- =====================================================================

-- Test the function with known coordinates
SELECT
    'Mumbai' as city,
    detect_region_from_coords(19.0760, 72.8777) as detected_region_id,
    r.name as region_name
FROM regions r
WHERE r.id = detect_region_from_coords(19.0760, 72.8777);

SELECT
    'Jaipur' as city,
    detect_region_from_coords(26.9124, 75.7873) as detected_region_id,
    r.name as region_name
FROM regions r
WHERE r.id = detect_region_from_coords(26.9124, 75.7873);

-- =====================================================================
-- Completion Message
-- =====================================================================

SELECT
    '✅ Region ID update complete!' as status,
    CONCAT(COUNT(region_id), ' items have region_id') as result
FROM infrastructure_items;
