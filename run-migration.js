/**
 * Run database migration to add missing fields
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function runMigration() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    console.log('📝 Running migration...');

    // Add gender field
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN gender ENUM('Male', 'Female', 'Other') DEFAULT 'Other' AFTER full_name
      `);
      console.log('✅ Added gender field');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  gender field already exists');
      else throw e;
    }

    // Add street field
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN street VARCHAR(255) AFTER department
      `);
      console.log('✅ Added street field');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  street field already exists');
      else throw e;
    }

    // Add city field
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN city VARCHAR(100) AFTER street
      `);
      console.log('✅ Added city field');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  city field already exists');
      else throw e;
    }

    // Add state field
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN state VARCHAR(100) AFTER city
      `);
      console.log('✅ Added state field');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  state field already exists');
      else throw e;
    }

    // Add pincode field
    try {
      await connection.execute(`
        ALTER TABLE users
        ADD COLUMN pincode VARCHAR(20) AFTER state
      `);
      console.log('✅ Added pincode field');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ️  pincode field already exists');
      else throw e;
    }

    console.log('\n📊 Updated users table structure:');
    console.log('='.repeat(80));
    const [columns] = await connection.execute('DESCRIBE users');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})`);
    });

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Fields already exist, skipping...');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the migration
runMigration();
