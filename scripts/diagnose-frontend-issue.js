/**
 * Diagnose Frontend Data Loading Issue
 * Usage: node scripts/diagnose-frontend-issue.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

async function diagnose() {
  try {
    console.log('\n🔍 DIAGNOSING FRONTEND DATA LOADING ISSUE\n');
    console.log('='.repeat(70));

    // 1. Check data distribution
    console.log('\n1️⃣  Database Item Type Distribution:');
    const [distribution] = await pool.query(`
      SELECT item_type, COUNT(*) as count
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY item_type
    `);
    console.table(distribution);

    // 2. Sample data from each type
    console.log('\n2️⃣  Sample POP Items (First 5):');
    const [popSamples] = await pool.query(`
      SELECT id, item_type, item_name, ROUND(latitude, 4) as lat, ROUND(longitude, 4) as lng, status
      FROM infrastructure_items
      WHERE source = 'KML' AND item_type = 'POP'
      ORDER BY id
      LIMIT 5
    `);
    console.table(popSamples);

    console.log('\n3️⃣  Sample SubPOP Items (First 5):');
    const [subpopSamples] = await pool.query(`
      SELECT id, item_type, item_name, ROUND(latitude, 4) as lat, ROUND(longitude, 4) as lng, status
      FROM infrastructure_items
      WHERE source = 'KML' AND item_type = 'SubPOP'
      ORDER BY id
      LIMIT 5
    `);
    console.table(subpopSamples);

    // 3. Check what the API would return (simulate API call)
    console.log('\n4️⃣  Simulating API Response (India Bounds):');
    const [apiResponse] = await pool.query(`
      SELECT
        id,
        item_type,
        item_name,
        latitude,
        longitude,
        status,
        region_id
      FROM infrastructure_items
      WHERE source = 'KML'
        AND latitude BETWEEN 8 AND 35
        AND longitude BETWEEN 68 AND 97
        AND status IN ('Active', 'RFS', 'Maintenance')
      LIMIT 10
    `);
    console.log(`   API would return ${apiResponse.length} items (showing first 10):`);
    console.table(apiResponse);

    // 4. Check if there are any NULL coordinates
    console.log('\n5️⃣  Checking for NULL or Invalid Coordinates:');
    const [[invalidCoords]] = await pool.query(`
      SELECT COUNT(*) as count
      FROM infrastructure_items
      WHERE source = 'KML'
        AND (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)
    `);
    console.log(`   Items with NULL/invalid coordinates: ${invalidCoords.count}`);

    // 5. Get coordinate ranges to understand data spread
    console.log('\n6️⃣  Coordinate Ranges (Verify data spread):');
    const [[ranges]] = await pool.query(`
      SELECT
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lng,
        MAX(longitude) as max_lng,
        ROUND(AVG(latitude), 2) as avg_lat,
        ROUND(AVG(longitude), 2) as avg_lng
      FROM infrastructure_items
      WHERE source = 'KML'
    `);
    console.log('   Latitude range:', ranges.min_lat, 'to', ranges.max_lat);
    console.log('   Longitude range:', ranges.min_lng, 'to', ranges.max_lng);
    console.log('   Center point:', ranges.avg_lat, ',', ranges.avg_lng);

    // 6. Geographic distribution
    console.log('\n7️⃣  Geographic Distribution by Item Type:');
    const [geoDistribution] = await pool.query(`
      SELECT
        item_type,
        COUNT(*) as count,
        ROUND(MIN(latitude), 2) as min_lat,
        ROUND(MAX(latitude), 2) as max_lat,
        ROUND(MIN(longitude), 2) as min_lng,
        ROUND(MAX(longitude), 2) as max_lng
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY item_type
    `);
    console.table(geoDistribution);

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ DIAGNOSIS COMPLETE\n');
    console.log('📋 FINDINGS:');
    console.log(`   - Total KML items in DB: ${distribution.reduce((sum, d) => sum + d.count, 0)}`);
    console.log(`   - Items with invalid coords: ${invalidCoords.count}`);
    console.log(`   - Data spread: Lat ${ranges.min_lat} to ${ranges.max_lat}, Lng ${ranges.min_lng} to ${ranges.max_lng}`);

    console.log('\n💡 RECOMMENDATIONS FOR FRONTEND:');
    console.log('   1. Make sure API call includes ALL bounds (north=35, south=8, east=97, west=68)');
    console.log('   2. Check if frontend is filtering by item_type incorrectly');
    console.log('   3. Verify both POP and SubPOP markers are being rendered');
    console.log('   4. Check if layer toggles are hiding one type');
    console.log('   5. Ensure icon colors are different: POP (green), SubPOP (lime/yellow-green)\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

diagnose();
