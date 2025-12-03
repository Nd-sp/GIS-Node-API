// test_db_queries.js
// Run this on production server: node test_db_queries.js

const mysql = require('mysql2/promise');
require('dotenv').config();

// Manual config since we might not load .env correctly in standalone
const dbConfig = {
  host: '172.16.20.6',
  user: 'root',
  password: 'Karma@1107',
  database: 'opticonnectgis_db',
  port: 3306
};

async function testQueries() {
  console.log('🔌 Connecting to database...');
  console.log(`   Host: ${dbConfig.host}`);
  console.log(`   User: ${dbConfig.user}`);
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected successfully!');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return;
  }

  // Test User ID (using admin ID 1)
  const userId = 1;
  const whereCondition = 'WHERE created_by = ?';
  const whereParams = [userId];

  console.log('\n🧪 Testing DataHub Queries (simulating /api/datahub/all)...');

  const queries = [
    {
      name: 'Distance Measurements',
      sql: `SELECT d.*, u.username as username FROM distance_measurements d
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.created_by = ?
            ORDER BY d.created_at DESC`
    },
    {
      name: 'Polygon Drawings',
      sql: `SELECT p.*, u.username as username FROM polygon_drawings p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.created_by = ?
            ORDER BY p.created_at DESC`
    },
    {
      name: 'Circle Drawings',
      sql: `SELECT c.*, u.username as username FROM circle_drawings c
            LEFT JOIN users u ON c.created_by = u.id
            WHERE c.created_by = ?
            ORDER BY c.created_at DESC`
    },
    {
      name: 'Elevation Profiles',
      sql: `SELECT e.*, u.username as username FROM elevation_profiles e
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.created_by = ?
            ORDER BY e.created_at DESC`
    },
    {
      name: 'Infrastructure Items',
      sql: `SELECT i.*, u.username as username FROM infrastructure_items i
            LEFT JOIN users u ON i.created_by = u.id
            WHERE i.created_by = ?
            ORDER BY i.created_at DESC`
    },
    {
      name: 'Sector RF Data',
      sql: `SELECT s.*, u.username as username FROM sector_rf_data s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC`
    },
    {
      name: 'Fiber Rings',
      sql: `SELECT f.*, u.username as username FROM fiber_rings f
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.created_by = ?
            ORDER BY f.created_at DESC`
    }
  ];

  for (const query of queries) {
    try {
      process.stdout.write(`   Testing ${query.name}... `);
      await connection.query(query.sql, whereParams);
      console.log('✅ OK');
    } catch (err) {
      console.log('❌ FAILED');
      console.error(`   Error: ${err.message}`);
      console.error(`   SQL: ${query.sql}`);
    }
  }

  console.log('\n🏁 Test completed.');
  await connection.end();
}

testQueries();
