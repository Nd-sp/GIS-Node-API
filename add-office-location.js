/**
 * Add office_location field to users table
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

async function addOfficeLocation() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    console.log('📝 Adding office_location field...');

    // Add office_location field
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN office_location VARCHAR(255) AFTER department
      `);
      console.log('✅ Added office_location field');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  office_location field already exists');
      } else {
        throw e;
      }
    }

    console.log('\n📊 Updated users table structure:');
    console.log('='.repeat(80));
    const [columns] = await connection.execute('DESCRIBE users');
    columns.forEach(col => {
      const highlight = col.Field === 'office_location' ? ' ⭐ NEW' : '';
      console.log(`- ${col.Field} (${col.Type})${highlight}`);
    });

    console.log('\n✅ Migration completed successfully!');

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

// Run the migration
addOfficeLocation();
