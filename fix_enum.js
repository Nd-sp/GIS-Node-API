const mysql = require('mysql2/promise');

async function fixEnum() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Ved@1498@!!',
      database: 'opticonnectgis_db'
    });

    console.log('✅ Connected to database');
    console.log('🔧 Adding "hierarchy" to report_type ENUM...\n');

    // Alter the column to add 'hierarchy' to the ENUM
    await connection.query(`
      ALTER TABLE dev_tool_reports
      MODIFY COLUMN report_type ENUM('frontend', 'fullstack', 'architecture', 'dependency_graph', 'hierarchy') NOT NULL
    `);

    console.log('✅ Successfully updated report_type column!\n');

    // Verify the change
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM dev_tool_reports WHERE Field = 'report_type'"
    );

    console.log('Updated report_type column:');
    console.log('  Type:', columns[0].Type);
    console.log('  Allowed values:', columns[0].Type.match(/'[^']+'/g).join(', '));

    await connection.end();
    console.log('\n✅ Fix complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixEnum();
