const mysql = require('mysql2/promise');

async function verify() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Ved@1498@!!',
      database: 'opticonnectgis_db'
    });

    console.log('✅ Connected to database\n');

    // Check dev_tool_reports table structure
    const [reportColumns] = await connection.query(
      "SHOW COLUMNS FROM dev_tool_reports WHERE Field = 'report_type'"
    );

    console.log('dev_tool_reports.report_type column:');
    console.log('  Type:', reportColumns[0].Type);
    console.log('  Allowed values:', reportColumns[0].Type.match(/'[^']+'/g).join(', '));

    // Check dev_tool_settings table
    const [settingsTables] = await connection.query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'opticonnectgis_db' AND table_name = 'dev_tool_settings'"
    );

    console.log('\n✅ dev_tool_settings table exists:', settingsTables[0].count === 1);

    // Check permissions were added
    const [permissions] = await connection.query(
      "SELECT permission_id FROM user_permissions WHERE permission_id LIKE 'devtools.%' GROUP BY permission_id"
    );

    console.log('\n📋 Developer Tools permissions created:');
    permissions.forEach(p => console.log(`  - ${p.permission_id}`));

    await connection.end();
    console.log('\n✅ Verification complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verify();
