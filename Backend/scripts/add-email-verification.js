/**
 * Add Email Verification Columns
 * Simple script to add email verification fields to users table
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

async function addEmailVerificationColumns() {
  try {
    console.log('🔄 Adding email verification columns...\n');

    // Add columns
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE COMMENT 'Whether user email has been verified',
        ADD COLUMN email_verified_at DATETIME NULL COMMENT 'Timestamp when email was verified',
        ADD COLUMN verification_token VARCHAR(255) NULL COMMENT 'Token for email verification',
        ADD COLUMN verification_token_expires DATETIME NULL COMMENT 'Expiration time for verification token'
      `);
      console.log('✅ Columns added successfully\n');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  Columns already exist\n');
      } else {
        throw error;
      }
    }

    // Mark existing Admin users as verified
    try {
      const [result] = await pool.query(`
        UPDATE users
        SET is_email_verified = TRUE,
            email_verified_at = NOW()
        WHERE role = 'Admin' AND (is_email_verified = FALSE OR is_email_verified IS NULL)
      `);
      console.log(`✅ Marked ${result.affectedRows} admin user(s) as verified\n`);
    } catch (error) {
      console.log('ℹ️  Could not update existing admins (columns may not exist yet)\n');
    }

    // Show updated schema
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'opticonnectgis_db'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME IN ('is_email_verified', 'email_verified_at', 'verification_token', 'verification_token_expires')
      ORDER BY ORDINAL_POSITION
    `);

    console.log('📊 Email verification columns:');
    console.table(columns);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addEmailVerificationColumns();
