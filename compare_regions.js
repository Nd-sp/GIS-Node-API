const mysql = require('mysql2/promise');
const fs = require('fs');

async function compareRegions() {
  const pool = mysql.createPool({
    host: '172.16.20.6',
    user: 'root',
    password: 'Karma@1107',
    database: 'opticonnectgis_db',
    port: 3306
  });

  try {
    const userId = 39; // HIMIL CHAUHAN

    // Get regions from database
    const [dbRegions] = await pool.query(
      `SELECT r.name FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true
       ORDER BY r.name`,
      [userId]
    );
    const dbStateNames = dbRegions.map(r => r.name);

    // Get regions from GeoJSON
    const geojsonPath = 'C:/Users/hkcha/OneDrive/Desktop/New folder/OptiConnect_Frontend/public/india.json';
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    const geojsonStateNames = geojsonData.features.map(f => f.properties.st_nm).sort();

    console.log('=== COMPARISON REPORT ===\n');
    console.log(`Database regions: ${dbStateNames.length}`);
    console.log(`GeoJSON regions: ${geojsonStateNames.length}\n`);

    // Find regions in DB but not in GeoJSON (won't be highlighted)
    console.log('❌ IN DATABASE BUT NOT IN GEOJSON (Won\'t show on map):');
    const missing = [];
    for (const dbState of dbStateNames) {
      const found = geojsonStateNames.some(geoState => 
        geoState.toLowerCase() === dbState.toLowerCase() ||
        geoState.toLowerCase().includes(dbState.toLowerCase()) ||
        dbState.toLowerCase().includes(geoState.toLowerCase())
      );
      if (!found) {
        missing.push(dbState);
        console.log(`  - ${dbState}`);
      }
    }

    if (missing.length === 0) {
      console.log('  None (all DB regions have matches)\n');
    } else {
      console.log(`\nTotal missing: ${missing.length}\n`);
    }

    // Find partial matches that might not work
    console.log('⚠️  FUZZY MATCHES (might not work correctly):');
    for (const dbState of dbStateNames) {
      for (const geoState of geojsonStateNames) {
        if (dbState.toLowerCase() === geoState.toLowerCase()) {
          continue; // Exact match, skip
        }
        if (dbState.toLowerCase().includes(geoState.toLowerCase()) ||
            geoState.toLowerCase().includes(dbState.toLowerCase())) {
          console.log(`  - DB: "${dbState}" <-> GeoJSON: "${geoState}"`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

compareRegions();
