/**
 * Check database tables and schema
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function checkTables() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    // Check all tables
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📊 All tables in database:');
    console.log('='.repeat(80));
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${Object.values(table)[0]}`);
    });

    // Check users table structure
    console.log('\n📋 Users table structure:');
    console.log('='.repeat(80));
    const [userColumns] = await connection.execute('DESCRIBE users');
    userColumns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // Check if user_regions table exists
    const [userRegionsTables] = await connection.execute("SHOW TABLES LIKE 'user_regions'");
    if (userRegionsTables.length > 0) {
      console.log('\n📋 User_regions table structure:');
      console.log('='.repeat(80));
      const [regionColumns] = await connection.execute('DESCRIBE user_regions');
      regionColumns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
      });
    } else {
      console.log('\n❌ user_regions table does NOT exist!');
    }

    // Check if regions table exists
    const [regionsTables] = await connection.execute("SHOW TABLES LIKE 'regions'");
    if (regionsTables.length > 0) {
      console.log('\n📋 Regions table structure:');
      console.log('='.repeat(80));
      const [regColumns] = await connection.execute('DESCRIBE regions');
      regColumns.forEach(col => {
        console.log(`- ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
      });
    } else {
      console.log('\n❌ regions table does NOT exist!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the script
checkTables();
