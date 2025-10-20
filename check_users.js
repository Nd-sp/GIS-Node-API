const mysql = require('mysql2/promise');

async function checkUsers() {
  const pool = mysql.createPool({
    host: '172.16.20.6',
    user: 'root',
    password: 'Karma@1107',
    database: 'opticonnectgis_db',
    port: 3306
  });

  try {
    const [users] = await pool.query('SELECT id, username, email, full_name, role FROM users WHERE is_active = true');
    console.log('=== ACTIVE USERS ===\n');
    for (const user of users) {
      console.log(`ID: ${user.id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Full Name: ${user.full_name}`);
      console.log(`Role: ${user.role}`);
      console.log('---');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();
