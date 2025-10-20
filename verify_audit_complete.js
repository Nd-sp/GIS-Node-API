const { pool } = require('./src/config/database');

async function verifyAuditComplete() {
  try {
    console.log('🔍 Complete Audit Trail:\n');

    const [rows] = await pool.query(`
      SELECT
        id,
        infrastructure_id,
        user_id,
        action,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at
      FROM infrastructure_audit
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (rows.length > 0) {
      console.log(`✅ Found ${rows.length} audit entries:\n`);
      rows.forEach(row => {
        console.log(`Audit ID: ${row.id}`);
        console.log(`  Action: ${row.action}`);
        console.log(`  User ID: ${row.user_id}`);
        console.log(`  Infrastructure ID: ${row.infrastructure_id}`);
        console.log(`  IP: ${row.ip_address || 'N/A'}`);
        console.log(`  User Agent: ${row.user_agent ? row.user_agent.substring(0, 50) + '...' : 'N/A'}`);
        console.log(`  Timestamp: ${row.created_at}`);
        if (row.new_values) {
          const newVal = typeof row.new_values === 'string' ? row.new_values : JSON.stringify(row.new_values);
          console.log(`  New Values: ${newVal.substring(0, 100)}...`);
        }
        if (row.old_values) {
          const oldVal = typeof row.old_values === 'string' ? row.old_values : JSON.stringify(row.old_values);
          console.log(`  Old Values: ${oldVal.substring(0, 100)}...`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️ No audit logs found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAuditComplete();
