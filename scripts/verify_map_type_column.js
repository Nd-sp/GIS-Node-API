const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyAndAddMapTypeColumn() {
  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Meetpapa@1',
      database: process.env.DB_NAME || 'telecom_gis'
    });

    console.log('✅ Connected to database');

    // Check if default_map_type column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'user_map_preferences'
        AND COLUMN_NAME = 'default_map_type'
    `, [process.env.DB_NAME || 'telecom_gis']);

    if (columns.length > 0) {
      console.log('✅ Column default_map_type already exists');

      // Show current table structure
      const [tableStructure] = await connection.query(`
        DESCRIBE user_map_preferences
      `);

      console.log('\n📋 Current table structure:');
      console.table(tableStructure);

    } else {
      console.log('⚠️  Column default_map_type does not exist');
      console.log('➕ Adding default_map_type column...');

      // Add the column
      await connection.query(`
        ALTER TABLE user_map_preferences
        ADD COLUMN default_map_type VARCHAR(20) DEFAULT 'satellite'
        AFTER user_id
      `);

      console.log('✅ Column default_map_type added successfully');

      // Show updated table structure
      const [tableStructure] = await connection.query(`
        DESCRIBE user_map_preferences
      `);

      console.log('\n📋 Updated table structure:');
      console.table(tableStructure);
    }

    // Check if there are any existing preferences without map type
    const [prefsWithoutMapType] = await connection.query(`
      SELECT COUNT(*) as count
      FROM user_map_preferences
      WHERE default_map_type IS NULL
    `);

    if (prefsWithoutMapType[0].count > 0) {
      console.log(`\n⚠️  Found ${prefsWithoutMapType[0].count} preferences without map type`);
      console.log('🔄 Setting default map type to "satellite"...');

      await connection.query(`
        UPDATE user_map_preferences
        SET default_map_type = 'satellite'
        WHERE default_map_type IS NULL
      `);

      console.log('✅ Updated all preferences with default map type');
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
verifyAndAddMapTypeColumn()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
