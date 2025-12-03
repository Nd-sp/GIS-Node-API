const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function testLogin() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Ved@1498@!!',
      database: 'opticonnectgis_db'
    });

    console.log('✅ Connected to database\n');

    // Get user from database (same query as login controller)
    const [users] = await connection.query(
      `SELECT id, email, username, role, password, password_hash, is_active, is_email_verified
       FROM users
       WHERE email = ? OR username = ?`,
      ['admin@opticonnect.com', 'admin@opticonnect.com']
    );

    if (users.length === 0) {
      console.log('❌ User not found!');
      return;
    }

    const user = users[0];

    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 User Data from Database:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('Role:', user.role);
    console.log('Is Active:', user.is_active);
    console.log('Email Verified:', user.is_email_verified);
    console.log('\n🔐 Password Fields:');
    console.log('password column:', user.password ? `${user.password.substring(0, 30)}...` : 'NULL');
    console.log('password_hash column:', user.password_hash ? `${user.password_hash.substring(0, 30)}...` : 'NULL');
    console.log('═══════════════════════════════════════════════════════\n');

    // Test password comparison with both columns
    const testPassword = 'Admin@123';

    console.log('🧪 Testing password: Admin@123\n');

    // Test with password column
    if (user.password) {
      const matchPassword = await bcrypt.compare(testPassword, user.password);
      console.log('✓ Compare with "password" column:', matchPassword ? '✅ MATCH' : '❌ NO MATCH');
    } else {
      console.log('✓ Compare with "password" column: ⚠️  Column is NULL');
    }

    // Test with password_hash column
    if (user.password_hash) {
      const matchHash = await bcrypt.compare(testPassword, user.password_hash);
      console.log('✓ Compare with "password_hash" column:', matchHash ? '✅ MATCH' : '❌ NO MATCH');
    } else {
      console.log('✓ Compare with "password_hash" column: ⚠️  Column is NULL');
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📝 Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Login should work if ONE of the columns matched ✅');
    console.log('Backend authController.js line 98 checks: user.password_hash');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testLogin();
