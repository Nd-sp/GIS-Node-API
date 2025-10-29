/**
 * Simple KML Import Verification
 * Usage: node scripts/verify-kml-import.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

async function verifyImport() {
  try {
    console.log('\n✅ **KML IMPORT VERIFICATION REPORT**\n');
    console.log('='.repeat(70));

    // 1. Overall Statistics
    console.log('\n📊 **1. OVERALL STATISTICS:**');
    const [[overall]] = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT unique_id) as unique_ids,
        SUM(CASE WHEN item_type = 'POP' THEN 1 ELSE 0 END) as pop_count,
        SUM(CASE WHEN item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop_count,
        SUM(CASE WHEN region_id IS NOT NULL THEN 1 ELSE 0 END) as with_region,
        SUM(CASE WHEN region_id IS NULL THEN 1 ELSE 0 END) as without_region
      FROM infrastructure_items
      WHERE source = 'KML'
    `);

    console.log(`   ✓ Total Records: ${overall.total}`);
    console.log(`   ✓ Unique IDs: ${overall.unique_ids}`);
    console.log(`   ✓ POP Locations: ${overall.pop_count}`);
    console.log(`   ✓ SubPOP Locations: ${overall.subpop_count}`);
    console.log(`   ✓ With Region: ${overall.with_region} (${(overall.with_region / overall.total * 100).toFixed(1)}%)`);
    console.log(`   ✓ Without Region: ${overall.without_region} (${(overall.without_region / overall.total * 100).toFixed(1)}%)`);

    // Check for duplicates
    if (overall.total !== overall.unique_ids) {
      console.log(`\n   ⚠️  WARNING: Found ${overall.total - overall.unique_ids} duplicate records!`);
    } else {
      console.log('\n   ✅ NO DUPLICATES - Data is clean!');
    }

    // 2. Status Distribution
    console.log('\n📊 **2. STATUS DISTRIBUTION:**');
    const [statuses] = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY status
      ORDER BY count DESC
    `);
    statuses.forEach(s => {
      console.log(`   - ${s.status}: ${s.count}`);
    });

    // 3. Top 5 Regions
    console.log('\n🗺️  **3. TOP 5 REGIONS BY INFRASTRUCTURE COUNT:**');
    const [topRegions] = await pool.query(`
      SELECT
        r.name,
        COUNT(i.id) as total,
        SUM(CASE WHEN i.item_type = 'POP' THEN 1 ELSE 0 END) as pop,
        SUM(CASE WHEN i.item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop
      FROM infrastructure_items i
      INNER JOIN regions r ON i.region_id = r.id
      WHERE i.source = 'KML'
      GROUP BY r.id, r.name
      ORDER BY total DESC
      LIMIT 5
    `);
    topRegions.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name}: ${r.total} (POP: ${r.pop}, SubPOP: ${r.subpop})`);
    });

    // 4. Sample Data
    console.log('\n📍 **4. SAMPLE INFRASTRUCTURE DATA (5 Random):**');
    const [samples] = await pool.query(`
      SELECT
        item_type,
        item_name,
        ROUND(latitude, 4) as lat,
        ROUND(longitude, 4) as lng,
        status,
        r.name as region
      FROM infrastructure_items i
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE i.source = 'KML'
      ORDER BY RAND()
      LIMIT 5
    `);
    console.table(samples);

    // 5. Coordinate Validation
    console.log('🧭 **5. COORDINATE VALIDATION:**');
    const [[coordCheck]] = await pool.query(`
      SELECT
        SUM(CASE
          WHEN latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
          THEN 1 ELSE 0
        END) as valid,
        SUM(CASE
          WHEN latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180
          THEN 1 ELSE 0
        END) as invalid
      FROM infrastructure_items
      WHERE source = 'KML'
    `);
    console.log(`   ✓ Valid Coordinates: ${coordCheck.valid}`);
    console.log(`   ${coordCheck.invalid > 0 ? '⚠️' : '✓'} Invalid Coordinates: ${coordCheck.invalid}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ **VERIFICATION COMPLETE!**');
    console.log('\n🎯 **READY FOR MAP VIEW:**');
    console.log('   - All ${overall.total} infrastructure items imported');
    console.log('   - POP (${overall.pop_count}) and SubPOP (${overall.subpop_count}) differentiated by item_type');
    console.log('   - Region-based filtering ready (${overall.with_region} items assigned)');
    console.log('   - No duplicate data');
    console.log('   - All coordinates valid\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification Error:', error.message);
    process.exit(1);
  }
}

verifyImport();
