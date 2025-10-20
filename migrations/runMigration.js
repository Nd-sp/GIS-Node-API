const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    console.log('📂 Reading migration file...');

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'add_search_columns.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolons and filter out comments and empty statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        return stmt.length > 0 &&
               !stmt.startsWith('--') &&
               !stmt.startsWith('/*') &&
               !stmt.toUpperCase().startsWith('USE');
      });

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);

        // Show a preview of the statement
        const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`   ${preview}${stmt.length > 80 ? '...' : ''}`);

        await pool.query(stmt);
        console.log(`✅ Statement ${i + 1} completed successfully`);
      } catch (error) {
        // Check if error is "column already exists" - that's OK
        if (error.code === 'ER_DUP_FIELDNAME' || error.errno === 1060) {
          console.log(`⚠️  Column already exists - skipping`);
        } else if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.errno === 1050) {
          console.log(`⚠️  Table already exists - skipping`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log('\n✨ Migration completed successfully!');
    console.log('🎉 All search columns have been added to the database');

    // Close the pool
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
