const fs = require('fs');
const mysql = require('mysql2/promise');

async function runMigration() {
  try {
    // Read the migration file
    const sql = fs.readFileSync('migrations/019_developer_tools.sql', 'utf8');

    // Create connection
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Ved@1498@!!',
      database: 'opticonnectgis_db',
      multipleStatements: true
    });

    console.log('Connected to database...');
    console.log('Running migration 019_developer_tools.sql...');

    // Execute the migration
    await connection.query(sql);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    const [tables] = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'opticonnectgis_db' AND table_name IN ('dev_tool_reports', 'dev_tool_settings')"
    );

    console.log('\nTables created:');
    tables.forEach(table => console.log(`  - ${table.TABLE_NAME}`));

    await connection.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
