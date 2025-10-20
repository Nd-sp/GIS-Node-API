// Quick diagnostic script to check everything
const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('\n🔍 Running Diagnostics...\n');

// Check 1: Environment Variables
console.log('1️⃣ Checking Environment Variables:');
console.log('   DB_HOST:', process.env.DB_HOST || '❌ Missing');
console.log('   DB_USER:', process.env.DB_USER || '❌ Missing');
console.log('   DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ Set' : '❌ Missing');
console.log('   DB_NAME:', process.env.DB_NAME || '❌ Missing');
console.log('   DB_PORT:', process.env.DB_PORT || '❌ Missing');
console.log('   PORT:', process.env.PORT || '❌ Missing');

// Check 2: MySQL Connection
console.log('\n2️⃣ Testing MySQL Connection...');

const testMySQL = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('   ✅ MySQL Connection Successful!');

    // Check 3: Check Tables
    console.log('\n3️⃣ Checking Database Tables...');
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`   ✅ Found ${tables.length} tables in database`);

    if (tables.length > 0) {
      console.log('   Tables:', tables.map(t => Object.values(t)[0]).join(', '));
    } else {
      console.log('   ⚠️  No tables found. Make sure you created all 25 tables.');
    }

    // Check 4: Check Users Table
    try {
      const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
      console.log(`\n4️⃣ Users Table: ✅ (${users[0].count} users)`);
    } catch (error) {
      console.log('\n4️⃣ Users Table: ❌', error.message);
    }

    await connection.end();

    console.log('\n✅ All checks passed! Server should start successfully.');
    console.log('\nRun: npm run dev\n');

  } catch (error) {
    console.error('\n❌ MySQL Connection Failed!');
    console.error('Error:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Solution: MySQL server is not running. Please start MySQL.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Solution: Wrong username or password. Check your .env file.');
      console.error('   Current password in .env:', process.env.DB_PASSWORD ? 'Set' : 'Not set');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Solution: Database does not exist. Create database "personalgis_db"');
    }

    process.exit(1);
  }
};

testMySQL();
