/**
 * Import accurate GeoJSON boundaries from india.json into regions table
 * This enables point-in-polygon checks for accurate region assignment
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// State name mapping (india.json names -> our database names)
const STATE_NAME_MAPPING = {
  'Delhi': 'Delhi NCR',
  'Andhra Pradesh': 'Andhra Pradesh',
  'Arunachal Pradesh': 'Arunachal Pradesh',
  'Assam': 'Assam',
  'Bihar': 'Bihar',
  'Chhattisgarh': 'Chhattisgarh',
  'Goa': 'Goa',
  'Gujarat': 'Gujarat',
  'Haryana': 'Haryana',
  'Himachal Pradesh': 'Himachal Pradesh',
  'Jharkhand': 'Jharkhand',
  'Karnataka': 'Karnataka',
  'Kerala': 'Kerala',
  'Madhya Pradesh': 'Madhya Pradesh',
  'Maharashtra': 'Maharashtra',
  'Manipur': 'Manipur',
  'Meghalaya': 'Meghalaya',
  'Mizoram': 'Mizoram',
  'Nagaland': 'Nagaland',
  'Odisha': 'Odisha',
  'Punjab': 'Punjab',
  'Rajasthan': 'Rajasthan',
  'Sikkim': 'Sikkim',
  'Tamil Nadu': 'Tamil Nadu',
  'Telangana': 'Telangana',
  'Tripura': 'Tripura',
  'Uttar Pradesh': 'Uttar Pradesh',
  'Uttarakhand': 'Uttarakhand',
  'West Bengal': 'West Bengal',
  'Andaman and Nicobar Islands': 'Andaman and Nicobar Islands',
  'Chandigarh': 'Chandigarh',
  'Dadra and Nagar Haveli': 'Dadra and Nagar Haveli',
  'Daman and Diu': 'Daman and Diu',
  'Jammu and Kashmir': 'Jammu and Kashmir',
  'Ladakh': 'Ladakh',
  'Lakshadweep': 'Lakshadweep',
  'Puducherry': 'Puducherry'
};

async function importGeoJSONBoundaries() {
  let connection;

  try {
    console.log('🗺️ Starting GeoJSON boundary import...\n');

    // 1. Read india.json file
    const indiaJsonPath = path.join(__dirname, '../../Frontend/public/india.json');
    console.log('📖 Reading:', indiaJsonPath);

    if (!fs.existsSync(indiaJsonPath)) {
      throw new Error('india.json not found at: ' + indiaJsonPath);
    }

    const indiaGeoJSON = JSON.parse(fs.readFileSync(indiaJsonPath, 'utf8'));
    console.log('✅ Loaded GeoJSON with', indiaGeoJSON.features.length, 'states\n');

    // 2. Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ Connected to database\n');

    // 3. Add geojson_boundary column if it doesn't exist
    console.log('🔧 Adding geojson_boundary column to regions table...');
    try {
      await connection.query(`
        ALTER TABLE regions
        ADD COLUMN geojson_boundary JSON DEFAULT NULL
      `);
      console.log('✅ Column added\n');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✅ Column already exists\n');
      } else {
        throw error;
      }
    }

    // 4. Update each region with its GeoJSON boundary
    let updated = 0;
    let notFound = 0;

    for (const feature of indiaGeoJSON.features) {
      const stateName = feature.properties.st_nm;
      const dbStateName = STATE_NAME_MAPPING[stateName] || stateName;
      const geometry = feature.geometry;

      // Check if region exists in database
      const [regions] = await connection.query(
        'SELECT id, name FROM regions WHERE name = ?',
        [dbStateName]
      );

      if (regions.length === 0) {
        console.log('⚠️  State not found in database:', dbStateName, '(from:', stateName + ')');
        notFound++;
        continue;
      }

      // Update region with GeoJSON boundary
      await connection.query(
        'UPDATE regions SET geojson_boundary = ? WHERE id = ?',
        [JSON.stringify(geometry), regions[0].id]
      );

      console.log('✅ Updated:', dbStateName);
      updated++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Import Summary:');
    console.log('='.repeat(50));
    console.log('✅ Updated:', updated, 'regions');
    console.log('⚠️  Not found:', notFound, 'regions');
    console.log('='.repeat(50) + '\n');

    // 5. Verify the import
    const [stats] = await connection.query(`
      SELECT
        COUNT(*) as total_regions,
        SUM(CASE WHEN geojson_boundary IS NOT NULL THEN 1 ELSE 0 END) as with_boundaries,
        SUM(CASE WHEN geojson_boundary IS NULL THEN 1 ELSE 0 END) as without_boundaries
      FROM regions
    `);

    console.log('📊 Database Statistics:');
    console.log('- Total regions:', stats[0].total_regions);
    console.log('- With GeoJSON boundaries:', stats[0].with_boundaries);
    console.log('- Without boundaries:', stats[0].without_boundaries);

    if (stats[0].without_boundaries > 0) {
      console.log('\n⚠️  Regions without boundaries:');
      const [missingRegions] = await connection.query(`
        SELECT id, name FROM regions WHERE geojson_boundary IS NULL
      `);
      missingRegions.forEach(r => console.log('  -', r.name));
    }

    console.log('\n✅ GeoJSON boundary import completed successfully!');

  } catch (error) {
    console.error('❌ Error importing GeoJSON boundaries:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the import
importGeoJSONBoundaries();
