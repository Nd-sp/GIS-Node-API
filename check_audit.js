const { pool } = require('./src/config/database');

async function checkAudit() {
  try {
    console.log('🔍 Checking infrastructure_audit table...\n');

    const [rows] = await pool.query(`
      SELECT
        id,
        infrastructure_id,
        user_id,
        action,
        created_at,
        JSON_EXTRACT(new_values, '$.item_name') as item_name
      FROM infrastructure_audit
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (rows.length > 0) {
      console.log('✅ Audit logs found:');
      rows.forEach(row => {
        console.log(`   - ${row.action} by user ${row.user_id} on infrastructure ${row.infrastructure_id} at ${row.created_at}`);
      });
    } else {
      console.log('⚠️ No audit logs found yet');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAudit();
