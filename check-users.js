/**
 * Check all users in the database
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
};

async function checkUsers() {
  let connection;

  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ Connected to database\n');

    // Get all users
    const [users] = await connection.execute(
      'SELECT id, username, email, full_name, role, is_active, created_at FROM users ORDER BY id DESC'
    );

    console.log('📊 Total users in database:', users.length);
    console.log('\n' + '='.repeat(100));
    console.log('ALL USERS:');
    console.log('='.repeat(100));

    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Full Name: ${user.full_name || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`   Created: ${user.created_at}`);
    });

    console.log('\n' + '='.repeat(100));

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
checkUsers();
