-- Migration: Add region_id column to all GIS tool tables
-- Date: 2025-11-26

-- Polygon Drawings
ALTER TABLE polygon_drawings ADD COLUMN region_id INT NULL AFTER user_id;
ALTER TABLE polygon_drawings ADD INDEX idx_polygon_region_id (region_id);
ALTER TABLE polygon_drawings ADD CONSTRAINT fk_polygon_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Circle Drawings
ALTER TABLE circle_drawings ADD COLUMN region_id INT NULL AFTER user_id;
ALTER TABLE circle_drawings ADD INDEX idx_circle_region_id (region_id);
ALTER TABLE circle_drawings ADD CONSTRAINT fk_circle_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Elevation Profiles
ALTER TABLE elevation_profiles ADD COLUMN region_id INT NULL AFTER created_by;
ALTER TABLE elevation_profiles ADD INDEX idx_elevation_region_id (region_id);
ALTER TABLE elevation_profiles ADD CONSTRAINT fk_elevation_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

-- Distance Measurements
ALTER TABLE distance_measurements ADD COLUMN region_id INT NULL AFTER created_by;
ALTER TABLE distance_measurements ADD INDEX idx_distance_region_id (region_id);
ALTER TABLE distance_measurements ADD CONSTRAINT fk_distance_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL;

SELECT 'Migration completed successfully - added region_id to all GIS tool tables' AS status;
