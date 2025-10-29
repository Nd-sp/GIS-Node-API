-- Migration: Add indexes for coordinate-based queries
-- Purpose: Optimize map viewport filtering and clustering performance
-- Created: 2025-10-29

-- Add composite index for latitude and longitude (bounding box queries)
-- This significantly speeds up queries like: WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?
CREATE INDEX idx_infrastructure_coordinates ON infrastructure_items(latitude, longitude);

-- Add index on latitude only (for partial coordinate filtering)
CREATE INDEX idx_infrastructure_latitude ON infrastructure_items(latitude);

-- Add index on longitude only (for partial coordinate filtering)
CREATE INDEX idx_infrastructure_longitude ON infrastructure_items(longitude);

-- Add composite index for region-based map queries
-- Combines region_id, item_type, and status for efficient filtering
CREATE INDEX idx_infrastructure_region_type_status ON infrastructure_items(region_id, item_type, status);

-- Add composite index for user-based map queries
CREATE INDEX idx_infrastructure_user_type_status ON infrastructure_items(user_id, item_type, status);

-- Display current indexes
SELECT
    TABLE_NAME,
    INDEX_NAME,
    COLUMN_NAME,
    SEQ_IN_INDEX,
    INDEX_TYPE
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'infrastructure_items'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
