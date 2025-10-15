const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00' // Force UTC timezone to prevent time mismatch
});

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database Connected Successfully!');
    console.log(`📊 Database: ${process.env.DB_NAME}`);

    // Check timezone settings (optional - don't fail if this errors)
    try {
      const [tzResult] = await connection.query('SELECT @@session.time_zone as tz');
      const [timeResult] = await connection.query('SELECT NOW() as server_time, UTC_TIMESTAMP() as utc_time');
      console.log('🕐 MySQL Timezone:', tzResult[0].tz);
      console.log('🕐 Server Time:', timeResult[0].server_time);
      console.log('🕐 UTC Time:', timeResult[0].utc_time);
    } catch (tzError) {
      console.log('⚠️  Could not check timezone settings:', tzError.message);
    }

    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL Connection Failed:');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('\nConnection Details:');
    console.error('- Host:', process.env.DB_HOST);
    console.error('- Port:', process.env.DB_PORT);
    console.error('- User:', process.env.DB_USER);
    console.error('- Database:', process.env.DB_NAME);
    console.error('- Password:', process.env.DB_PASSWORD ? 'Set (length: ' + process.env.DB_PASSWORD.length + ')' : 'NOT SET');

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Solution: MySQL server is not running. Please start MySQL service.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Solution: Wrong username or password. Check your .env file.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Solution: Database does not exist. Create database "optionnectgis_db"');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Solution: Cannot find host. Check DB_HOST in .env');
    }

    console.error('\nPlease check your .env file and ensure MySQL is running');
    return false;
  }
};

// Execute query helper function
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Query Error:', error);
    throw error;
  }
};

module.exports = { pool, testConnection, executeQuery };
