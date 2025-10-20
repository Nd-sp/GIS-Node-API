const mysql = require('mysql2/promise');

async function checkUserRegions() {
  const pool = mysql.createPool({
    host: '172.16.20.6',
    user: 'root',
    password: 'Karma@1107',
    database: 'opticonnectgis_db',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('=== DATABASE REGION ASSIGNMENT CHECK ===\n');

    // Get total regions in database
    const [regions] = await pool.query('SELECT COUNT(*) as total FROM regions WHERE is_active = true');
    console.log(`Total active regions in database: ${regions[0].total}\n`);

    // Get all users
    const [users] = await pool.query('SELECT id, username, full_name FROM users WHERE is_active = true');
    console.log(`Total active users: ${users.length}\n`);

    // Check each user's regions
    for (const user of users) {
      const [userRegions] = await pool.query(
        `SELECT COUNT(*) as count FROM user_regions WHERE user_id = ?`,
        [user.id]
      );
      
      console.log(`User: ${user.full_name} (ID: ${user.id}, Username: ${user.username})`);
      console.log(`  Assigned regions: ${userRegions[0].count}\n`);

      // If user has regions, show them
      if (userRegions[0].count > 0) {
        const [regionList] = await pool.query(
          `SELECT r.name FROM regions r 
           INNER JOIN user_regions ur ON r.id = ur.region_id 
           WHERE ur.user_id = ? 
           ORDER BY r.name`,
          [user.id]
        );
        console.log(`  Regions: ${regionList.map(r => r.name).join(', ')}\n`);
      }
    }

    // Check for any orphaned region assignments
    const [orphaned] = await pool.query(
      `SELECT COUNT(*) as count FROM user_regions ur 
       LEFT JOIN users u ON ur.user_id = u.id 
       WHERE u.id IS NULL`
    );
    console.log(`Orphaned region assignments (no matching user): ${orphaned[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUserRegions();
