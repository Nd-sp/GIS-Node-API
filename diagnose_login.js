const mysql = require('mysql2/promise');
const { comparePassword } = require('./src/utils/bcrypt');

async function diagnoseLogin() {
  let connection;

  try {
    console.log('🔍 DIAGNOSING LOGIN ISSUE\n');
    console.log('═══════════════════════════════════════════════════════\n');

    // Connect to database
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Ved@1498@!!',
      database: 'opticonnectgis_db'
    });

    console.log('✅ Step 1: Database connection successful\n');

    // Simulate login process exactly as authController does
    const email = 'admin@opticonnect.com';
    const password = 'Admin@123';

    console.log('📝 Step 2: Login Attempt');
    console.log('   Email:', email);
    console.log('   Password: Admin@123\n');

    // Query exactly as authController.js does (line 56-65)
    const query = `SELECT u.*, creator.full_name as created_by_name,
               CONVERT_TZ(u.last_login, @@session.time_zone, '+00:00') as last_login_utc,
               CONVERT_TZ(u.created_at, @@session.time_zone, '+00:00') as created_at_utc,
               CONVERT_TZ(u.updated_at, @@session.time_zone, '+00:00') as updated_at_utc,
               CONVERT_TZ(u.email_verified_at, @@session.time_zone, '+00:00') as email_verified_at_utc,
               CONVERT_TZ(u.mfa_enabled_at, @@session.time_zone, '+00:00') as mfa_enabled_at_utc
               FROM users u
               LEFT JOIN users creator ON u.created_by = creator.id
               WHERE u.email = ? OR u.username = ?`;

    const [users] = await connection.query(query, [email, email]);

    if (users.length === 0) {
      console.log('❌ Step 3: FAILED - User not found\n');
      return;
    }

    console.log('✅ Step 3: User found in database\n');

    const user = users[0];

    // Check is_active (line 80-85)
    console.log('🔒 Step 4: Check if user is active');
    console.log('   is_active:', user.is_active);
    if (!user.is_active) {
      console.log('   ❌ FAILED - Account is deactivated\n');
      return;
    }
    console.log('   ✅ PASSED - Account is active\n');

    // Check is_email_verified (line 88-95)
    console.log('📧 Step 5: Check if email is verified');
    console.log('   is_email_verified:', user.is_email_verified);
    if (!user.is_email_verified) {
      console.log('   ❌ FAILED - Email not verified\n');
      return;
    }
    console.log('   ✅ PASSED - Email is verified\n');

    // Check password (line 98-105)
    console.log('🔐 Step 6: Password comparison');
    console.log('   Password from input: Admin@123');
    console.log('   password_hash from DB:', user.password_hash ? user.password_hash.substring(0, 30) + '...' : 'NULL');

    if (!user.password_hash) {
      console.log('   ❌ CRITICAL ERROR - password_hash is NULL in database!\n');
      return;
    }

    // Use the SAME comparePassword function as authController
    const isPasswordValid = await comparePassword(password, user.password_hash);

    console.log('   Result:', isPasswordValid ? '✅ MATCH' : '❌ NO MATCH');

    if (!isPasswordValid) {
      console.log('\n   ❌ Step 6: FAILED - Password does not match');
      console.log('   Backend would return: 401 "Invalid email or password"\n');
      return;
    }

    console.log('   ✅ PASSED - Password matches!\n');

    // Check MFA (line 108)
    console.log('🔐 Step 7: Check 2FA status');
    console.log('   mfa_enabled:', user.mfa_enabled);
    if (user.mfa_enabled) {
      console.log('   ⚠️  2FA is enabled - would require code\n');
    } else {
      console.log('   ✅ PASSED - No 2FA required\n');
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 DIAGNOSIS COMPLETE: LOGIN SHOULD WORK!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n✅ All checks passed. Login credentials are correct.');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@opticonnect.com');
    console.log('   Password: Admin@123');
    console.log('\n🚀 If login still fails:');
    console.log('   1. Restart the backend server');
    console.log('   2. Clear browser cache and cookies');
    console.log('   3. Check backend console logs for specific error');
    console.log('   4. Verify backend is running on port 82');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

diagnoseLogin();
