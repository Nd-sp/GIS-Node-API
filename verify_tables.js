const { pool } = require('./src/config/database');

async function verifyTables() {
  try {
    console.log('🔍 Checking infrastructure tables...\n');

    // Check infrastructure_items table
    const [items] = await pool.query(`
      SHOW COLUMNS FROM infrastructure_items
    `);
    console.log('✅ infrastructure_items table exists with columns:');
    items.forEach(col => console.log(`   - ${col.Field} (${col.Type})`));

    // Check infrastructure_categories table
    const [categories] = await pool.query(`
      SHOW COLUMNS FROM infrastructure_categories
    `);
    console.log('\n✅ infrastructure_categories table exists with columns:');
    categories.forEach(col => console.log(`   - ${col.Field} (${col.Type})`));

    // Check infrastructure_audit table
    const [audit] = await pool.query(`
      SHOW COLUMNS FROM infrastructure_audit
    `);
    console.log('\n✅ infrastructure_audit table exists with columns:');
    audit.forEach(col => console.log(`   - ${col.Field} (${col.Type})`));

    console.log('\n✅ All 3 infrastructure tables verified successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyTables();
