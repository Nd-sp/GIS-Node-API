/**
 * Remove Duplicate KML Entries
 * Keeps only the latest entry for each unique_id
 * Usage: node scripts/remove-duplicates.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

async function removeDuplicates() {
  try {
    console.log('🧹 Removing Duplicate KML Entries\n');
    console.log('='.repeat(60));

    // 1. Check current state
    console.log('\n📊 Before cleanup:');
    const [[before]] = await pool.query(`
      SELECT COUNT(*) as total FROM infrastructure_items WHERE source = 'KML'
    `);
    console.log(`   Total KML records: ${before.total}`);

    // 2. Find duplicates
    console.log('\n🔍 Finding duplicates...');
    const [duplicates] = await pool.query(`
      SELECT unique_id, COUNT(*) as count
      FROM infrastructure_items
      WHERE source = 'KML'
      GROUP BY unique_id
      HAVING count > 1
    `);

    if (duplicates.length === 0) {
      console.log('   ✅ No duplicates found!');
      process.exit(0);
    }

    console.log(`   Found ${duplicates.length} unique_ids with duplicates`);
    console.log(`   Total duplicate records: ${duplicates.reduce((sum, d) => sum + (d.count - 1), 0)}`);

    // 3. Remove duplicates (keep only the record with highest ID = latest)
    console.log('\n🗑️  Removing duplicate records...');

    const result = await pool.query(`
      DELETE i1 FROM infrastructure_items i1
      INNER JOIN (
        SELECT unique_id, MAX(id) as max_id
        FROM infrastructure_items
        WHERE source = 'KML'
        GROUP BY unique_id
        HAVING COUNT(*) > 1
      ) i2 ON i1.unique_id = i2.unique_id
      WHERE i1.source = 'KML'
      AND i1.id < i2.max_id
    `);

    const deletedCount = result[0].affectedRows;
    console.log(`   ✅ Deleted ${deletedCount} duplicate records`);

    // 4. Check final state
    console.log('\n📊 After cleanup:');
    const [[after]] = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT unique_id) as unique_ids,
        SUM(CASE WHEN item_type = 'POP' THEN 1 ELSE 0 END) as pop_count,
        SUM(CASE WHEN item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop_count
      FROM infrastructure_items
      WHERE source = 'KML'
    `);

    console.log(`   Total records: ${after.total}`);
    console.log(`   Unique IDs: ${after.unique_ids}`);
    console.log(`   POP: ${after.pop_count}`);
    console.log(`   SubPOP: ${after.subpop_count}`);

    if (after.total === after.unique_ids) {
      console.log('\n   ✅ All duplicates removed! Data is now clean.');
    } else {
      console.log('\n   ⚠️  Still have duplicates! May need manual cleanup.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✨ Cleanup Complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

removeDuplicates();
