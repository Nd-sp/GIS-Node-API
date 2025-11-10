/**
 * Accurately assign regions to infrastructure items using point-in-polygon algorithm
 * This uses the GeoJSON boundaries stored in the database
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Point-in-polygon algorithm using ray casting
 * Works with MultiPolygon GeoJSON geometries
 */
function isPointInPolygon(point, polygon) {
  const [lng, lat] = point;
  let inside = false;

  // Handle MultiPolygon
  if (polygon.type === 'MultiPolygon') {
    for (const poly of polygon.coordinates) {
      if (isPointInSinglePolygon([lng, lat], poly)) {
        return true;
      }
    }
    return false;
  }

  // Handle Polygon
  if (polygon.type === 'Polygon') {
    return isPointInSinglePolygon([lng, lat], polygon.coordinates);
  }

  return false;
}

function isPointInSinglePolygon(point, polygonCoords) {
  const [lng, lat] = point;

  // Use the outer ring (first array) for point-in-polygon test
  const ring = polygonCoords[0];
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

async function assignRegionsAccurately() {
  let connection;

  try {
    console.log('🗺️ Starting accurate region assignment using GeoJSON boundaries...\n');

    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ Connected to database\n');

    // 1. Load all regions with GeoJSON boundaries
    console.log('📖 Loading region boundaries...');
    const [regions] = await connection.query(`
      SELECT id, name, geojson_boundary
      FROM regions
      WHERE geojson_boundary IS NOT NULL AND is_active = TRUE
    `);

    if (regions.length === 0) {
      throw new Error('No regions with GeoJSON boundaries found! Run import_geojson_boundaries.js first.');
    }

    console.log('✅ Loaded', regions.length, 'regions with boundaries\n');

    // Parse GeoJSON for each region
    const regionBoundaries = regions.map(r => ({
      id: r.id,
      name: r.name,
      geometry: typeof r.geojson_boundary === 'string'
        ? JSON.parse(r.geojson_boundary)
        : r.geojson_boundary
    }));

    // 2. Get all infrastructure items
    console.log('📖 Loading infrastructure items...');
    const [items] = await connection.query(`
      SELECT id, item_name, latitude, longitude, region_id
      FROM infrastructure_items
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    console.log('✅ Loaded', items.length, 'infrastructure items\n');

    // 3. Process items in batches
    const BATCH_SIZE = 100;
    let updated = 0;
    let notFound = 0;
    let alreadyCorrect = 0;

    console.log('🔄 Processing items...\n');

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
        const point = [item.longitude, item.latitude];
        let matchedRegion = null;

        // Check which region contains this point
        for (const region of regionBoundaries) {
          if (isPointInPolygon(point, region.geometry)) {
            matchedRegion = region;
            break;
          }
        }

        if (matchedRegion) {
          if (item.region_id !== matchedRegion.id) {
            // Update region
            await connection.query(
              'UPDATE infrastructure_items SET region_id = ? WHERE id = ?',
              [matchedRegion.id, item.id]
            );
            updated++;

            if (updated % 50 === 0) {
              console.log(`✅ Updated ${updated} items...`);
            }
          } else {
            alreadyCorrect++;
          }
        } else {
          // Point not in any region (might be outside India or in disputed territory)
          notFound++;
          if (notFound <= 10) {
            console.log(`⚠️  No region found for: ${item.item_name} (${item.latitude}, ${item.longitude})`);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Assignment Summary:');
    console.log('='.repeat(60));
    console.log('✅ Updated:', updated, 'items');
    console.log('✓  Already correct:', alreadyCorrect, 'items');
    console.log('⚠️  Not found in any region:', notFound, 'items');
    console.log('📍 Total processed:', items.length, 'items');
    console.log('='.repeat(60) + '\n');

    // 4. Show distribution by region
    console.log('📊 Items per region:');
    const [distribution] = await connection.query(`
      SELECT
        r.name as region_name,
        COUNT(i.id) as item_count
      FROM regions r
      LEFT JOIN infrastructure_items i ON i.region_id = r.id
      WHERE r.geojson_boundary IS NOT NULL
      GROUP BY r.id, r.name
      HAVING item_count > 0
      ORDER BY item_count DESC
    `);

    distribution.forEach(r => {
      console.log(`  ${r.region_name}: ${r.item_count} items`);
    });

    console.log('\n✅ Accurate region assignment completed successfully!');

  } catch (error) {
    console.error('❌ Error assigning regions:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the assignment
assignRegionsAccurately();
