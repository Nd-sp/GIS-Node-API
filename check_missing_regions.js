const mysql = require('mysql2/promise');

async function checkMissingRegions() {
  const pool = mysql.createPool({
    host: '172.16.20.6',
    user: 'root',
    password: 'Karma@1107',
    database: 'opticonnectgis_db',
    port: 3306
  });

  try {
    const userId = 39; // HIMIL CHAUHAN

    console.log('=== CHECKING REGIONS FOR USER ID 39 ===\n');

    // Get all regions assigned to user (including inactive)
    const [allUserRegions] = await pool.query(
      `SELECT r.id, r.name, r.is_active, ur.assigned_at
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ?
       ORDER BY r.name`,
      [userId]
    );

    console.log(`Total regions in user_regions table: ${allUserRegions.length}\n`);

    // Get only active regions
    const [activeUserRegions] = await pool.query(
      `SELECT r.id, r.name, r.is_active
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true
       ORDER BY r.name`,
      [userId]
    );

    console.log(`Active regions (is_active = true): ${activeUserRegions.length}\n`);

    // Find inactive regions
    const inactiveRegions = allUserRegions.filter(r => !r.is_active);
    if (inactiveRegions.length > 0) {
      console.log('❌ INACTIVE REGIONS (these won\'t show on map):');
      for (const region of inactiveRegions) {
        console.log(`  - ${region.name} (ID: ${region.id}, is_active: ${region.is_active})`);
      }
      console.log('');
    }

    // List all active regions
    console.log('✅ ACTIVE REGIONS:');
    for (const region of activeUserRegions) {
      console.log(`  - ${region.name}`);
    }
    console.log('');

    // Check all regions in database
    const [allRegions] = await pool.query(
      'SELECT id, name, is_active FROM regions ORDER BY name'
    );

    console.log(`\n=== ALL REGIONS IN DATABASE: ${allRegions.length} ===`);
    const inactive = allRegions.filter(r => !r.is_active);
    if (inactive.length > 0) {
      console.log(`\nInactive regions (${inactive.length}):`);
      for (const r of inactive) {
        console.log(`  - ${r.name} (ID: ${r.id})`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkMissingRegions();
