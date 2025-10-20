const { pool } = require('./src/config/database');

async function fixInfrastructureSchema() {
  try {
    console.log('🔧 Fixing infrastructure tables schema...');

    // Drop tables in correct order (due to foreign keys)
    await pool.query('DROP TABLE IF EXISTS infrastructure_audit');
    console.log('✅ Dropped infrastructure_audit');

    await pool.query('DROP TABLE IF EXISTS infrastructure_imports');
    console.log('✅ Dropped infrastructure_imports');

    await pool.query('DROP TABLE IF EXISTS infrastructure_items');
    console.log('✅ Dropped infrastructure_items');

    await pool.query('DROP TABLE IF EXISTS infrastructure_categories');
    console.log('✅ Dropped infrastructure_categories');

    console.log('\n✅ All infrastructure tables dropped successfully!');
    console.log('👉 Now restart the server to recreate them with the correct schema.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixInfrastructureSchema();
