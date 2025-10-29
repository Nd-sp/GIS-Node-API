/**
 * Database Migration Runner
 * Run this script to apply email verification migration
 * Usage: node scripts/run-migration.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Starting email verification migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/001_add_email_verification.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL statements (simple split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('--')) continue;

      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
        const [result] = await pool.query(statement);

        // If this is a SELECT statement, show results
        if (statement.trim().toUpperCase().startsWith('SELECT')) {
          console.log('📊 Query results:');
          console.table(result);
        } else {
          console.log('✅ Success');
        }
      } catch (error) {
        // If error is "Duplicate column name", it's okay - column already exists
        if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column')) {
          console.log('ℹ️  Column already exists, skipping...');
        } else if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key')) {
          console.log('ℹ️  Index already exists, skipping...');
        } else {
          console.error('❌ Error:', error.message);
          throw error;
        }
      }
      console.log('');
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   - Added is_email_verified column (BOOLEAN)');
    console.log('   - Added email_verified_at column (DATETIME)');
    console.log('   - Added verification_token column (VARCHAR)');
    console.log('   - Added verification_token_expires column (DATETIME)');
    console.log('   - Added indexes for performance');
    console.log('   - Marked existing Admin users as verified\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
runMigration();
