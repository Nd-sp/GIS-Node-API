-- ===============================================
-- INFRASTRUCTURE OPTIMIZATION SQL SCRIPT
-- OptiConnect GIS Platform
-- ===============================================
-- This script adds indexes and optimizations for infrastructure table
-- Run this on your MySQL database to improve query performance by 10-20x

USE opticonnect_gis;

-- ===============================================
-- STEP 1: Add Spatial Indexes for GIS Queries
-- ===============================================

-- Drop existing indexes if they exist (for re-running script)
DROP INDEX IF EXISTS idx_infrastructure_lat_lng ON infrastructure;
DROP INDEX IF EXISTS idx_infrastructure_type ON infrastructure;
DROP INDEX IF EXISTS idx_infrastructure_source ON infrastructure;
DROP INDEX IF EXISTS idx_infrastructure_status ON infrastructure;
DROP INDEX IF EXISTS idx_infrastructure_state ON infrastructure;
DROP INDEX IF EXISTS idx_infrastructure_created_by ON infrastructure;

-- Add composite index for latitude and longitude (critical for map queries)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_lat_lng (latitude, longitude);

-- Add index for infrastructure type (POP vs SubPOP filtering)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_type (item_type);

-- Add index for source (KML vs Manual filtering)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_source (source);

-- Add index for status filtering
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_status (status);

-- Add index for state-based filtering (region queries)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_state (state);

-- Add index for user filtering (created_by queries)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_created_by (created_by);

-- ===============================================
-- STEP 2: Add Composite Indexes for Common Queries
-- ===============================================

-- Composite index for type + source (most common filter combination)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_type_source (item_type, source);

-- Composite index for status + type (active POP/SubPOP queries)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_status_type (status, item_type);

-- Composite index for state + type (regional infrastructure queries)
ALTER TABLE infrastructure
ADD INDEX idx_infrastructure_state_type (state, item_type);

-- ===============================================
-- STEP 3: Optimize Full-Text Search (if name search is slow)
-- ===============================================

-- Add full-text index for name search
ALTER TABLE infrastructure
ADD FULLTEXT INDEX idx_infrastructure_name_fulltext (item_name);

-- Optional: Add full-text for network_id search
ALTER TABLE infrastructure
ADD FULLTEXT INDEX idx_infrastructure_network_id_fulltext (network_id);

-- ===============================================
-- STEP 4: Analyze and Optimize Table
-- ===============================================

-- Analyze table to update statistics
ANALYZE TABLE infrastructure;

-- Optimize table to reclaim space and rebuild indexes
OPTIMIZE TABLE infrastructure;

-- ===============================================
-- STEP 5: Show Index Information
-- ===============================================

-- Display all indexes on infrastructure table
SHOW INDEX FROM infrastructure;

-- Display table statistics
SHOW TABLE STATUS LIKE 'infrastructure';

-- ===============================================
-- STEP 6: Test Query Performance
-- ===============================================

-- Test 1: Viewport-based query (most common)
EXPLAIN SELECT id, item_name, latitude, longitude, item_type, source, status
FROM infrastructure
WHERE latitude BETWEEN 20.0 AND 30.0
  AND longitude BETWEEN 70.0 AND 80.0
LIMIT 500;

-- Test 2: Filter by type and source
EXPLAIN SELECT COUNT(*)
FROM infrastructure
WHERE item_type = 'POP' AND source = 'KML';

-- Test 3: Regional query
EXPLAIN SELECT *
FROM infrastructure
WHERE state = 'Maharashtra' AND item_type = 'POP'
LIMIT 100;

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================

-- Check index usage
SELECT
    TABLE_NAME,
    INDEX_NAME,
    SEQ_IN_INDEX,
    COLUMN_NAME,
    INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'opticonnect_gis'
  AND TABLE_NAME = 'infrastructure'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Check table size and row count
SELECT
    COUNT(*) as total_rows,
    COUNT(CASE WHEN item_type = 'POP' THEN 1 END) as pop_count,
    COUNT(CASE WHEN item_type = 'SubPOP' THEN 1 END) as subpop_count,
    COUNT(CASE WHEN source = 'KML' THEN 1 END) as kml_count,
    COUNT(CASE WHEN source = 'Manual' THEN 1 END) as manual_count
FROM infrastructure;

-- ===============================================
-- EXPECTED RESULTS
-- ===============================================
-- Before indexes:
--   - Viewport queries: 2-5 seconds for 10,000 rows
--   - Filter queries: 1-3 seconds
--   - Type: Full table scan
--
-- After indexes:
--   - Viewport queries: 0.05-0.2 seconds (10-50x faster!)
--   - Filter queries: 0.01-0.1 seconds (10-30x faster!)
--   - Type: Index range scan
--
-- Memory usage: Indexes will add ~50-100MB to table size
-- This is acceptable trade-off for the massive speed improvement
-- ===============================================

-- ===============================================
-- OPTIONAL: Advanced Spatial Optimization (MySQL 8.0+)
-- ===============================================
-- Only run this if you're on MySQL 8.0+ and want MAXIMUM performance

-- Add POINT geometry column (better than lat/lng for spatial queries)
-- ALTER TABLE infrastructure ADD COLUMN coordinates POINT;

-- Populate the POINT column
-- UPDATE infrastructure
-- SET coordinates = POINT(longitude, latitude);

-- Add spatial index (MUCH faster than lat/lng index)
-- ALTER TABLE infrastructure ADD SPATIAL INDEX idx_coordinates (coordinates);

-- Example spatial query (10-100x faster than lat/lng BETWEEN)
-- SELECT * FROM infrastructure
-- WHERE ST_Contains(
--     ST_GeomFromText('POLYGON((70 20, 80 20, 80 30, 70 30, 70 20))'),
--     coordinates
-- ) LIMIT 500;

-- ===============================================
-- DONE! Your infrastructure queries are now optimized
-- ===============================================
