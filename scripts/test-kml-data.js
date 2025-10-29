/**
 * Test Script: Verify KML Import and Data Integrity
 * Usage: node scripts/test-kml-data.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

async function testKMLData() {
  try {
    console.log('🔍 KML Data Integrity Check\n');
    console.log('='.repeat(60));

    // 1. Check for duplicates
    console.log('\n1️⃣  Checking for duplicate data...');
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT unique_id) as unique_ids,
        COUNT(DISTINCT CONCAT(latitude, ',', longitude)) as unique_coords
      FROM infrastructure_items
      WHERE source = 'KML'
    `);

    console.log('   Total records:', stats.total);
    console.log('   Unique IDs:', stats.unique_ids);
    console.log('   Unique coordinates:', stats.unique_coords);
    console.log('   Duplicate IDs:', stats.total - stats.unique_ids);
    console.log('   Duplicate coords:', stats.total - stats.unique_coords);

    if (stats.total > stats.unique_ids) {
      console.log('\n   ⚠️  Found duplicate unique_id values!');
      const [dups] = await pool.query(`
        SELECT unique_id, COUNT(*) as count
        FROM infrastructure_items
        WHERE source = 'KML'
        GROUP BY unique_id
        HAVING count > 1
        LIMIT 10
      `);
      console.table(dups);
    } else {
      console.log('   ✅ No duplicate IDs - data is clean!');
    }

    // 2. Check item type distribution
    console.log('\n2️⃣  Item Type Distribution:');
    const [typeStats] = await pool.query(`
      SELECT
        item_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM infrastructure_items WHERE source = 'KML'), 2) as percentage
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY item_type
      ORDER BY count DESC
    `);
    console.table(typeStats);

    // 3. Check region assignment
    console.log('\n3️⃣  Region Assignment Status:');
    const [regionStats] = await pool.query(`
      SELECT
        CASE WHEN region_id IS NULL THEN 'Unassigned' ELSE 'Assigned' END as status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM infrastructure_items WHERE source = 'KML'), 2) as percentage
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY status
    `);
    console.table(regionStats);

    // 4. Top regions by infrastructure count
    console.log('\n4️⃣  Top 10 Regions by Infrastructure Count:');
    const [topRegions] = await pool.query(`
      SELECT
        r.name as region_name,
        COUNT(i.id) as count,
        SUM(CASE WHEN i.item_type = 'POP' THEN 1 ELSE 0 END) as pop_count,
        SUM(CASE WHEN i.item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop_count
      FROM infrastructure_items i
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE i.source = 'KML' AND r.name IS NOT NULL
      GROUP BY r.name
      ORDER BY count DESC
      LIMIT 10
    `);
    console.table(topRegions);

    // 5. Status distribution
    console.log('\n5️⃣  Status Distribution:');
    const [statusStats] = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY status
      ORDER BY count DESC
    `);
    console.table(statusStats);

    // 6. Sample coordinates check (make sure they're valid)
    console.log('\n6️⃣  Coordinate Validation (Sample):');
    const [coordCheck] = await pool.query(`
      SELECT
        item_type,
        item_name,
        latitude,
        longitude,
        CASE
          WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
          THEN 'Valid'
          ELSE 'Invalid'
        END as validity
      FROM infrastructure_items
      WHERE source = 'KML'
      ORDER BY RAND()
      LIMIT 5
    `);
    console.table(coordCheck);

    // 7. Check for items without coordinates
    console.log('\n7️⃣  Checking for missing coordinates...');
    const [[missingCoords]] = await pool.query(`
      SELECT COUNT(*) as count
      FROM infrastructure_items
      WHERE source = 'KML'
      AND (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)
    `);

    if (missingCoords.count > 0) {
      console.log(`   ⚠️  Found ${missingCoords.count} items with missing/invalid coordinates`);
    } else {
      console.log('   ✅ All items have valid coordinates');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Data Integrity Check Complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    process.exit(1);
  }
}

testKMLData();
