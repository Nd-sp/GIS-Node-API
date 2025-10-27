/**
 * Migration script to add is_online column to users table
 * Run this script once to add the column for online status tracking
 */

const { pool } = require('./src/config/database');

async function addIsOnlineColumn() {
  try {
    console.log('🔄 Adding is_online column to users table...');

    // Check if column already exists
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'opticonnectgis_db'
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'is_online'`
    );

    if (columns.length > 0) {
      console.log('✅ Column is_online already exists!');
    } else {
      // Add the column
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN is_online BOOLEAN DEFAULT FALSE
         AFTER is_active`
      );
      console.log('✅ Successfully added is_online column!');
    }

    // Set all users to offline initially
    await pool.query('UPDATE users SET is_online = FALSE');
    console.log('✅ Set all users to offline status');

    console.log('✨ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addIsOnlineColumn();
