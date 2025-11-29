-- ============================================
-- Insert Sample Boundaries for Testing
-- Simple polygon boundaries for Indian states
-- ============================================

-- Sample boundary for Maharashtra (simplified polygon)
INSERT INTO region_boundaries (region_id, boundary_geojson, boundary_type, version, vertex_count, created_by, source, notes)
VALUES
(
  2, -- Maharashtra region_id
  JSON_OBJECT(
    'type', 'Polygon',
    'coordinates', JSON_ARRAY(
      JSON_ARRAY(
        -- Outer ring (simplified Maharashtra boundary)
        JSON_ARRAY(72.6369, 20.0911),  -- Northwest
        JSON_ARRAY(74.7821, 19.6012),  -- North
        JSON_ARRAY(77.5946, 18.5204),  -- Northeast
        JSON_ARRAY(78.1382, 17.9868),  -- East
        JSON_ARRAY(77.5320, 16.6867),  -- Southeast
        JSON_ARRAY(75.7139, 15.8497),  -- South
        JSON_ARRAY(73.8567, 16.1000),  -- Southwest
        JSON_ARRAY(72.8311, 17.7761),  -- West
        JSON_ARRAY(72.6369, 20.0911)   -- Close polygon (same as first point)
      )
    )
  ),
  'Polygon',
  1,
  9,
  1, -- Created by admin (user_id = 1)
  'Sample Data',
  'Initial sample boundary for testing - edit this to see the boundary editor in action!'
);

-- Sample boundary for Gujarat (simplified polygon)
INSERT INTO region_boundaries (region_id, boundary_geojson, boundary_type, version, vertex_count, created_by, source, notes)
VALUES
(
  3, -- Gujarat region_id
  JSON_OBJECT(
    'type', 'Polygon',
    'coordinates', JSON_ARRAY(
      JSON_ARRAY(
        -- Outer ring (simplified Gujarat boundary)
        JSON_ARRAY(68.1623, 23.7396),  -- Northwest
        JSON_ARRAY(71.1924, 24.7065),  -- North
        JSON_ARRAY(72.4826, 23.2420),  -- Northeast
        JSON_ARRAY(73.5093, 22.3072),  -- East
        JSON_ARRAY(72.9131, 20.7514),  -- Southeast
        JSON_ARRAY(70.6693, 20.2165),  -- South
        JSON_ARRAY(68.7782, 22.3072),  -- Southwest
        JSON_ARRAY(68.1623, 23.7396)   -- Close polygon
      )
    )
  ),
  'Polygon',
  1,
  8,
  1,
  'Sample Data',
  'Initial sample boundary for Gujarat'
);

-- Sample boundary for Mumbai District (smaller area)
INSERT INTO region_boundaries (region_id, boundary_geojson, boundary_type, version, vertex_count, created_by, source, notes)
VALUES
(
  7, -- Mumbai District region_id
  JSON_OBJECT(
    'type', 'Polygon',
    'coordinates', JSON_ARRAY(
      JSON_ARRAY(
        JSON_ARRAY(72.7761, 19.2695),  -- North
        JSON_ARRAY(72.9954, 19.2147),  -- Northeast
        JSON_ARRAY(73.0568, 18.8920),  -- East
        JSON_ARRAY(72.9131, 18.8920),  -- Southeast
        JSON_ARRAY(72.7761, 18.9388),  -- South
        JSON_ARRAY(72.7761, 19.2695)   -- Close polygon
      )
    )
  ),
  'Polygon',
  1,
  6,
  1,
  'Sample Data',
  'Sample boundary for Mumbai District'
);

-- Verify insertions
SELECT 'Sample boundaries inserted successfully!' as Status;
SELECT
  rb.id,
  r.name as region_name,
  rb.boundary_type,
  rb.version,
  rb.vertex_count,
  rb.created_at
FROM region_boundaries rb
JOIN regions r ON rb.region_id = r.id
ORDER BY rb.id;
