const mysql = require('mysql2/promise');

async function testPropsAnalysis() {
  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Ved@1498@!!',
      database: 'opticonnectgis_db'
    });

    console.log('✅ Connected to database');

    // Check current ENUM values
    const [columns] = await connection.query(`
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='dev_tool_reports'
      AND COLUMN_NAME='report_type'
    `);

    console.log('\n📊 Current report_type ENUM values:');
    console.log(columns[0].COLUMN_TYPE);

    // Try to insert a test record with 'props_analysis'
    console.log('\n🧪 Testing props_analysis insert...');

    try {
      const [result] = await connection.query(
        `INSERT INTO dev_tool_reports (report_type, status, started_by)
         VALUES ('props_analysis', 'running', 1)`
      );

      console.log('✅ SUCCESS! props_analysis is now a valid ENUM value');
      console.log(`   Inserted record ID: ${result.insertId}`);

      // Clean up test record
      await connection.query('DELETE FROM dev_tool_reports WHERE id = ?', [result.insertId]);
      console.log('   Test record cleaned up');

    } catch (insertError) {
      console.log('❌ FAILED! props_analysis is NOT in the ENUM');
      console.log(`   Error: ${insertError.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPropsAnalysis();
