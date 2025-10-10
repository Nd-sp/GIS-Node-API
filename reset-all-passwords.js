/**
 * Reset All User Passwords Utility
 * This script resets passwords for all users to known values
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

async function resetAllPasswords() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    // Get all users
    const [users] = await connection.execute(
      'SELECT id, username, email, role FROM users'
    );

    console.log('🔑 Resetting passwords for all users...\n');

    const defaultPasswords = {
      'admin@opticonnect.com': 'Admin@123',
      'himilchauhan1498@gmail.com': 'Himil@123'
    };

    for (const user of users) {
      const defaultPassword = defaultPasswords[user.email] || 'Password@123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);

      await connection.execute(
        'UPDATE users SET password_hash = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
        [passwordHash, user.id]
      );

      console.log(`✅ Reset password for: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   New Password: ${defaultPassword}\n`);
    }

    console.log('='.repeat(80));
    console.log('🎉 ALL PASSWORDS RESET SUCCESSFULLY!');
    console.log('='.repeat(80));
    console.log('\n📋 LOGIN CREDENTIALS:\n');

    console.log('1️⃣  ADMIN ACCOUNT:');
    console.log('   📧 Email: admin@opticonnect.com');
    console.log('   🔑 Password: Admin@123');
    console.log('   👤 Role: Admin\n');

    console.log('2️⃣  HIMIL ACCOUNT:');
    console.log('   📧 Email: himilchauhan1498@gmail.com');
    console.log('   🔑 Password: Himil@123');
    console.log('   👤 Role: User (Viewer)\n');

    console.log('='.repeat(80));

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
resetAllPasswords();
