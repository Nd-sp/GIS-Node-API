-- Copy Delhi GeoJSON to Delhi NCR
UPDATE regions r1
JOIN regions r2 ON r2.name = 'Delhi'
SET r1.geojson_boundary = (SELECT geojson_boundary FROM regions WHERE name = 'Delhi' LIMIT 1)
WHERE r1.name = 'Delhi NCR';
