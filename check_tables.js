const { pool } = require('./src/config/database');

async function checkTables() {
  try {
    // Check for user_map_preferences table (plural)
    const [prefTables] = await pool.query("SHOW TABLES LIKE 'user_map_preferences'");
    console.log('\n📋 User Map Preferences Table:', prefTables.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND');

    if (prefTables.length > 0) {
      const [prefColumns] = await pool.query("DESCRIBE user_map_preferences");
      console.log('\n📊 user_map_preferences columns:');
      prefColumns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
      });
    }

    // Check for search_history table
    const [searchTables] = await pool.query("SHOW TABLES LIKE 'search_history'");
    console.log('\n📋 Search History Table:', searchTables.length > 0 ? '✅ EXISTS' : '❌ NOT FOUND');

    if (searchTables.length > 0) {
      const [searchColumns] = await pool.query("DESCRIBE search_history");
      console.log('\n📊 search_history columns:');
      searchColumns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
