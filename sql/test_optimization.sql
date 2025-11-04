-- ===============================================
-- TEST OPTIMIZATION SCRIPT
-- OptiConnect GIS Platform
-- ===============================================
-- Run this AFTER running optimize_infrastructure.sql
-- to verify indexes were created successfully
-- ===============================================

USE opticonnect_gis;

-- ===============================================
-- TEST 1: Verify Indexes Exist
-- ===============================================

SELECT
    CONCAT('✅ Test 1: Checking Indexes') as Test_Name;

SELECT
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'infrastructure_items'
  AND INDEX_NAME LIKE 'idx_infrastructure%'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- ===============================================
-- TEST 2: Count Infrastructure Items
-- ===============================================

SELECT
    CONCAT('✅ Test 2: Counting Infrastructure Items') as Test_Name;

SELECT
    COUNT(*) as Total_Items,
    SUM(CASE WHEN item_type = 'POP' THEN 1 ELSE 0 END) as Total_POPs,
    SUM(CASE WHEN item_type = 'SubPOP' THEN 1 ELSE 0 END) as Total_SubPOPs,
    SUM(CASE WHEN source = 'KML' THEN 1 ELSE 0 END) as From_KML,
    SUM(CASE WHEN source = 'Manual' THEN 1 ELSE 0 END) as From_Manual
FROM infrastructure_items;

-- ===============================================
-- TEST 3: Test Query Performance
-- ===============================================

SELECT
    CONCAT('✅ Test 3: Testing Query Performance') as Test_Name;

-- Enable query profiling
SET profiling = 1;

-- Run test query (bounding box - simulates map viewport)
SELECT
    id, item_type, item_name, latitude, longitude, status
FROM infrastructure_items
WHERE latitude BETWEEN 20.0 AND 25.0
  AND longitude BETWEEN 70.0 AND 75.0
  AND status IN ('Active', 'RFS', 'Maintenance')
LIMIT 100;

-- Show query time
SHOW PROFILES;

-- ===============================================
-- TEST 4: Verify Index Usage
-- ===============================================

SELECT
    CONCAT('✅ Test 4: Verifying Index Usage') as Test_Name;

-- Check if query uses indexes
EXPLAIN SELECT
    id, item_type, item_name, latitude, longitude, status
FROM infrastructure_items
WHERE latitude BETWEEN 20.0 AND 25.0
  AND longitude BETWEEN 70.0 AND 75.0
  AND status IN ('Active', 'RFS', 'Maintenance')
LIMIT 100;

-- Should show "Using index" in Extra column ✅

-- ===============================================
-- RESULTS INTERPRETATION
-- ===============================================

SELECT
    CONCAT('
    ========================================
    OPTIMIZATION TEST RESULTS
    ========================================

    ✅ If you see 8+ indexes created, optimization succeeded!
    ✅ If query time is < 0.1 seconds, performance is excellent!
    ✅ If EXPLAIN shows "Using index", indexes are working!

    ❌ If indexes missing, run optimize_infrastructure.sql again
    ❌ If query slow (>1 second), check index creation

    Next Steps:
    1. Restart your backend server: npm start
    2. Test your frontend application
    3. Check /api/cache/stats endpoint

    ========================================
    ') as Instructions;
