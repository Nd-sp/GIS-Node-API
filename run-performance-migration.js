const pool = require('./src/config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Run API Performance Logs Migration
 * Creates the api_performance_logs table for analytics tracking
 */

async function runMigration() {
  console.log('🚀 Starting API Performance Logs Migration...\n');

  try {
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_api_performance_logs.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');

    // Split SQL statements (in case there are multiple)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);

      await pool.query(statement);
      console.log(`✅ Statement ${i + 1} executed successfully\n`);
    }

    // Verify table was created
    const [tables] = await pool.query("SHOW TABLES LIKE 'api_performance_logs'");

    if (tables.length > 0) {
      console.log('✅ Table "api_performance_logs" created successfully!\n');

      // Show table structure
      const [columns] = await pool.query('DESCRIBE api_performance_logs');
      console.log('📊 Table Structure:');
      console.table(columns.map(col => ({
        Field: col.Field,
        Type: col.Type,
        Null: col.Null,
        Key: col.Key,
        Default: col.Default
      })));

      // Show indexes
      const [indexes] = await pool.query('SHOW INDEX FROM api_performance_logs');
      console.log('\n🔑 Indexes:');
      console.table(indexes.map(idx => ({
        KeyName: idx.Key_name,
        Column: idx.Column_name,
        Unique: idx.Non_unique === 0 ? 'Yes' : 'No'
      })));
    } else {
      console.error('❌ Table creation failed - table not found');
      process.exit(1);
    }

    console.log('\n✨ Migration completed successfully!');
    console.log('🎯 You can now start tracking API performance metrics.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run migration
runMigration();
