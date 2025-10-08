/**
 * Database Schema Verification Script
 * Checks if all 25 tables exist with correct columns
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Expected tables and their critical columns
const EXPECTED_TABLES = {
  users: ['id', 'username', 'email', 'password_hash', 'full_name', 'role', 'is_active', 'created_at'],
  regions: ['id', 'name', 'code', 'type', 'parent_region_id', 'latitude', 'longitude', 'boundary_geojson'],
  user_regions: ['id', 'user_id', 'region_id', 'access_level', 'assigned_at', 'assigned_by'],
  permissions: ['id', 'name', 'code', 'category', 'description'],
  role_permissions: ['id', 'role', 'permission_id'],
  user_permissions: ['id', 'user_id', 'permission_id', 'granted'],
  groups: ['id', 'name', 'description', 'owner_id', 'is_public', 'is_active'],  // ✅ Fixed: owner_id, is_public
  group_members: ['id', 'group_id', 'user_id', 'role', 'joined_at', 'added_by'],  // ✅ Fixed: group_members (not usergroup_members)
  gis_features: ['id', 'name', 'feature_type', 'geometry', 'latitude', 'longitude', 'properties', 'tags', 'region_id', 'created_by'],  // ✅ Fixed: geometry, tags
  bookmarks: ['id', 'user_id', 'name', 'latitude', 'longitude', 'zoom_level'],
  search_history: ['id', 'user_id', 'search_query', 'search_type', 'searched_at'],
  audit_logs: ['id', 'user_id', 'action', 'resource_type', 'resource_id', 'details'],
  analytics_metrics: ['id', 'metric_type', 'metric_name', 'metric_value', 'recorded_at'],
  temporary_access: ['id', 'user_id', 'resource_type', 'resource_id', 'access_level', 'expires_at'],
  region_requests: ['id', 'user_id', 'region_id', 'request_type', 'status', 'requested_at'],
  distance_measurements: ['id', 'user_id', 'region_id', 'measurement_name', 'points', 'total_distance', 'unit'],
  polygon_drawings: ['id', 'user_id', 'region_id', 'polygon_name', 'coordinates', 'area', 'perimeter', 'fill_color'],
  circle_drawings: ['id', 'user_id', 'region_id', 'circle_name', 'center_lat', 'center_lng', 'radius'],
  sector_rf_data: ['id', 'user_id', 'region_id', 'sector_name', 'tower_lat', 'tower_lng', 'azimuth', 'beamwidth', 'radius'],
  elevation_profiles: ['id', 'user_id', 'region_id', 'profile_name', 'start_point', 'end_point', 'elevation_data'],
  infrastructure_items: ['id', 'user_id', 'region_id', 'item_type', 'item_name', 'latitude', 'longitude', 'status'],
  layer_management: ['id', 'user_id', 'region_id', 'layer_name', 'layer_type', 'layer_data', 'is_visible'],
  user_map_preferences: ['id', 'user_id', 'default_map_type', 'default_zoom', 'theme', 'measurement_unit'],
  data_hub_imports: ['id', 'user_id', 'region_id', 'import_type', 'import_status', 'records_imported'],
  data_hub_exports: ['id', 'user_id', 'region_id', 'export_type', 'export_status', 'records_exported']
};

async function verifySchema() {
  console.log('\n========================================');
  console.log('🔍 DATABASE SCHEMA VERIFICATION');
  console.log('========================================\n');

  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    console.log('✅ Connected to database:', process.env.DB_NAME);
    console.log('');

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    const existingTables = tables.map(t => Object.values(t)[0]);

    console.log(`📊 Total tables found: ${existingTables.length}`);
    console.log(`📋 Expected tables: ${Object.keys(EXPECTED_TABLES).length}\n`);

    let allValid = true;
    let missingTables = [];
    let tableIssues = [];

    // Check each expected table
    for (const [tableName, expectedColumns] of Object.entries(EXPECTED_TABLES)) {
      // Check if table exists
      if (!existingTables.includes(tableName)) {
        missingTables.push(tableName);
        console.log(`❌ Table '${tableName}' DOES NOT EXIST`);
        allValid = false;
        continue;
      }

      // Get table columns
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
      const actualColumns = columns.map(c => c.Field);

      // Check for missing columns
      const missing = expectedColumns.filter(col => !actualColumns.includes(col));

      if (missing.length > 0) {
        console.log(`⚠️  Table '${tableName}' - Missing columns: ${missing.join(', ')}`);
        tableIssues.push({ table: tableName, missing });
        allValid = false;
      } else {
        console.log(`✅ Table '${tableName}' - All critical columns present`);
      }
    }

    // Check for extra tables
    const extraTables = existingTables.filter(t => !Object.keys(EXPECTED_TABLES).includes(t));
    if (extraTables.length > 0) {
      console.log(`\n📌 Extra tables found (not in schema): ${extraTables.join(', ')}`);
    }

    // Summary
    console.log('\n========================================');
    console.log('📊 VERIFICATION SUMMARY');
    console.log('========================================\n');

    if (allValid) {
      console.log('✅ ALL TABLES VERIFIED SUCCESSFULLY!');
      console.log('✅ All 25 tables exist with correct columns');
      console.log('✅ Ready for API testing\n');
    } else {
      console.log('❌ SCHEMA VALIDATION FAILED\n');

      if (missingTables.length > 0) {
        console.log(`Missing Tables (${missingTables.length}):`);
        missingTables.forEach(t => console.log(`  - ${t}`));
        console.log('');
      }

      if (tableIssues.length > 0) {
        console.log(`Tables with Issues (${tableIssues.length}):`);
        tableIssues.forEach(({ table, missing }) => {
          console.log(`  - ${table}: missing columns [${missing.join(', ')}]`);
        });
        console.log('');
      }

      console.log('⚠️  Please run SCHEMA_FIX.sql to fix issues\n');
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run verification
verifySchema();
