/**
 * Reset Admin Password Utility
 * This script resets the admin user password to a known value
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function resetAdminPassword() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database');

    // New password
    const newPassword = 'Admin@123';
    console.log(`\n🔑 New password will be: ${newPassword}`);

    // Hash the password
    console.log('🔄 Hashing password...');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log('✅ Password hashed');

    // Update admin user
    console.log('🔄 Updating admin user...');
    const [result] = await connection.execute(
      `UPDATE users
       SET password_hash = ?,
           is_active = 1,
           updated_at = NOW()
       WHERE email = ?`,
      [passwordHash, 'admin@opticonnect.com']
    );

    if (result.affectedRows === 0) {
      console.log('⚠️  Admin user not found. Creating new admin user...');

      // Create new admin user
      await connection.execute(
        `INSERT INTO users (username, email, password_hash, full_name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        ['admin', 'admin@opticonnect.com', passwordHash, 'System Administrator', 'admin']
      );

      console.log('✅ New admin user created');
    } else {
      console.log('✅ Admin password updated');
    }

    // Display login credentials
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PASSWORD RESET SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('\n📧 Email: admin@opticonnect.com');
    console.log(`🔑 Password: ${newPassword}`);
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ You can now login with these credentials');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Run the script
resetAdminPassword();
