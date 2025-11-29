/**
 * Import Real State Boundaries from india.json
 * This script reads the actual GeoJSON boundary data and inserts it into region_boundaries table
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: '172.16.20.6',
  user: 'root',
  password: 'Karma@1107',
  database: 'opticonnectgis_db'
};

// NO state name mapping needed - use exact names from india.json
// The database regions were created to match india.json exactly

async function importBoundaries() {
  let connection;

  try {
    // 1. Read india.json
    console.log('📖 Reading india.json...');
    const indiaJsonPath = path.join(__dirname, '../../Frontend/public/india.json');
    const indiaData = JSON.parse(fs.readFileSync(indiaJsonPath, 'utf8'));

    console.log(`✅ Loaded ${indiaData.features.length} state boundaries\n`);

    // 2. Connect to database
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected\n');

    // 3. Get all regions from database
    console.log('📊 Fetching regions from database...');
    const [regions] = await connection.query(
      `SELECT id, name, code FROM regions WHERE type = 'state' AND is_active = TRUE`
    );
    console.log(`✅ Found ${regions.length} states in database\n`);

    // 4. Create a map of state name → region ID
    const regionMap = {};
    regions.forEach(region => {
      regionMap[region.name] = region.id;
    });

    // 5. Insert boundaries
    console.log('💾 Inserting boundaries...\n');
    let inserted = 0;
    let skipped = 0;

    for (const feature of indiaData.features) {
      const stateName = feature.properties.st_nm;
      const regionId = regionMap[stateName];

      if (!regionId) {
        console.log(`⚠️  Skipping "${stateName}" - not found in database`);
        skipped++;
        continue;
      }

      // Count vertices in the polygon
      let vertexCount = 0;
      if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          polygon.forEach(ring => {
            vertexCount += ring.length;
          });
        });
      } else if (feature.geometry.type === 'Polygon') {
        feature.geometry.coordinates.forEach(ring => {
          vertexCount += ring.length;
        });
      }

      // Insert boundary
      try {
        await connection.query(
          `INSERT INTO region_boundaries
           (region_id, boundary_geojson, boundary_type, version, vertex_count, created_by, source, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             boundary_geojson = VALUES(boundary_geojson),
             boundary_type = VALUES(boundary_type),
             vertex_count = VALUES(vertex_count),
             updated_at = NOW(),
             source = VALUES(source),
             notes = VALUES(notes)`,
          [
            regionId,
            JSON.stringify(feature.geometry),
            feature.geometry.type,
            1,
            vertexCount,
            1, // Created by admin (user_id = 1)
            'india.json (Official GeoJSON)',
            `Imported from india.json on ${new Date().toISOString()}`
          ]
        );

        console.log(`✅ ${stateName} (${vertexCount} vertices)`);
        inserted++;
      } catch (err) {
        console.log(`❌ Error inserting ${stateName}: ${err.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Import complete!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the import
importBoundaries();
