const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRegions() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  console.log('=== REGIONS TABLE STRUCTURE ===');
  const [cols] = await conn.execute('DESCRIBE regions');
  cols.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

  console.log('\n=== REGIONS DATA (first 10) ===');
  const [rows] = await conn.execute('SELECT * FROM regions LIMIT 10');
  console.table(rows);

  console.log('\n=== USER_REGIONS TABLE ===');
  const [urCols] = await conn.execute('DESCRIBE user_regions');
  urCols.forEach(c => console.log(`- ${c.Field} (${c.Type})`));

  console.log('\n=== USER_REGIONS DATA ===');
  const [urRows] = await conn.execute('SELECT * FROM user_regions');
  console.table(urRows);

  await conn.end();
}

checkRegions().catch(console.error);
