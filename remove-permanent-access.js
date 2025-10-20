require('dotenv').config();
const mysql = require('mysql2/promise');

const removePermAccess = async (userId, regionId) => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    console.log(`\n🔍 Checking permanent access for User ID: ${userId}, Region ID: ${regionId}\n`);

    // Check current access
    const [current] = await conn.query(
      'SELECT * FROM user_regions WHERE user_id = ? AND region_id = ?',
      [userId, regionId]
    );

    if (current.length === 0) {
      console.log('✅ No permanent access found. User can receive temporary access.');
      return;
    }

    console.log('📋 Current Permanent Access:');
    console.log(JSON.stringify(current[0], null, 2));
    console.log('\n❌ User has permanent access. Removing...\n');

    // Remove permanent access
    await conn.query(
      'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
      [userId, regionId]
    );

    console.log('✅ Permanent access removed successfully!');
    console.log('✅ User can now receive temporary access.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
  }
};

// Usage: node remove-permanent-access.js <userId> <regionId>
const userId = process.argv[2] || 32;
const regionId = process.argv[3] || 6;

removePermAccess(userId, regionId);
