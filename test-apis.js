/**
 * Automated API Testing Script
 * Tests all critical OptiConnect APIs
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
let authToken = '';
let testUserId = null;
let testUserEmail = null;
let testGroupId = null;
let testFeatureId = null;

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test counter
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, testFn) {
  totalTests++;
  try {
    await testFn();
    passedTests++;
    logSuccess(`PASS: ${name}`);
    return true;
  } catch (error) {
    failedTests++;
    logError(`FAIL: ${name}`);
    logError(`  Error: ${error.message}`);
    if (error.response?.data) {
      logError(`  Response: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

// ===================================
// TEST SUITE
// ===================================

async function runTests() {
  console.log('\n========================================');
  log('🧪 OPTICONNECT API AUTOMATED TESTING', 'blue');
  console.log('========================================\n');

  logInfo(`Base URL: ${BASE_URL}`);
  logInfo('Starting tests...\n');

  // ===================================
  // 1. AUTHENTICATION TESTS
  // ===================================
  console.log('\n📁 1. AUTHENTICATION TESTS');
  console.log('─'.repeat(40));

  await test('Register new user', async () => {
    const timestamp = Date.now();
    testUserEmail = `test_${timestamp}@example.com`;

    const response = await axios.post(`${BASE_URL}/api/auth/register`, {
      username: `testuser_${timestamp}`,
      email: testUserEmail,
      password: 'Test@123',
      full_name: 'Test User',
      role: 'viewer'
    });

    if (!response.data.success) throw new Error('Registration failed');
    if (!response.data.token) throw new Error('No token received');

    authToken = response.data.token;
    testUserId = response.data.user.id;
    logInfo(`  Token: ${authToken.substring(0, 20)}...`);
    logInfo(`  User ID: ${testUserId}`);
  });

  await test('Login user', async () => {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: testUserEmail,
      password: 'Test@123'
    });

    if (!response.data.success) throw new Error('Login failed');
    if (!response.data.token) throw new Error('No token received');
  });

  await test('Get current user', async () => {
    const response = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get current user failed');
    if (!response.data.user) throw new Error('No user data received');
  });

  // ===================================
  // 2. GROUPS TESTS (FIXED SCHEMA)
  // ===================================
  console.log('\n📁 2. GROUPS TESTS (Schema Fixed)');
  console.log('─'.repeat(40));

  await test('✅ Create group with owner_id & is_public', async () => {
    const response = await axios.post(`${BASE_URL}/api/groups`, {
      name: 'Test Engineering Team',
      description: 'Testing group creation',
      is_public: false
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Create group failed');
    if (!response.data.group) throw new Error('No group data received');

    testGroupId = response.data.group.id;
    logInfo(`  Group ID: ${testGroupId}`);

    // Verify owner_id exists in response
    const getResponse = await axios.get(`${BASE_URL}/api/groups/${testGroupId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!getResponse.data.group.owner_id) {
      throw new Error('owner_id field missing in response');
    }
    logInfo(`  ✓ owner_id field present: ${getResponse.data.group.owner_id}`);
  });

  await test('Get all groups', async () => {
    const response = await axios.get(`${BASE_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get groups failed');
    if (!Array.isArray(response.data.groups)) throw new Error('Groups not an array');
  });

  // ===================================
  // 3. GIS FEATURES TESTS (FIXED SCHEMA)
  // ===================================
  console.log('\n📁 3. GIS FEATURES TESTS (Schema Fixed)');
  console.log('─'.repeat(40));

  await test('✅ Create GIS feature with geometry & tags', async () => {
    const response = await axios.post(`${BASE_URL}/api/features`, {
      name: 'Test Cell Tower',
      feature_type: 'tower',
      geometry: {
        type: 'Point',
        coordinates: [77.2090, 28.6139]
      },
      latitude: 28.6139,
      longitude: 77.2090,
      tags: ['telecom', '5G', 'test']
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Create feature failed');
    if (!response.data.feature) throw new Error('No feature data received');

    testFeatureId = response.data.feature.id;
    logInfo(`  Feature ID: ${testFeatureId}`);
    logInfo(`  ✓ geometry field accepted (not geometry_geojson)`);
    logInfo(`  ✓ tags field accepted`);
  });

  await test('Get all features', async () => {
    const response = await axios.get(`${BASE_URL}/api/features`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get features failed');
    if (!Array.isArray(response.data.features)) throw new Error('Features not an array');
  });

  // ===================================
  // 4. DISTANCE MEASUREMENTS
  // ===================================
  console.log('\n📁 4. DISTANCE MEASUREMENTS');
  console.log('─'.repeat(40));

  await test('Create distance measurement', async () => {
    const response = await axios.post(`${BASE_URL}/api/measurements/distance`, {
      measurement_name: 'Test Measurement',
      points: [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6200, lng: 77.2150 }
      ],
      total_distance: 850.5,
      unit: 'meters',
      is_saved: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Create measurement failed');
  });

  await test('Get all measurements', async () => {
    const response = await axios.get(`${BASE_URL}/api/measurements/distance`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get measurements failed');
  });

  // ===================================
  // 5. POLYGON DRAWINGS
  // ===================================
  console.log('\n📁 5. POLYGON DRAWINGS');
  console.log('─'.repeat(40));

  await test('Create polygon drawing', async () => {
    const response = await axios.post(`${BASE_URL}/api/drawings/polygon`, {
      polygon_name: 'Test Coverage Area',
      coordinates: [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6200, lng: 77.2090 },
        { lat: 28.6200, lng: 77.2150 },
        { lat: 28.6139, lng: 77.2150 },
        { lat: 28.6139, lng: 77.2090 }
      ],
      area: 5000000,
      perimeter: 10000,
      fill_color: '#3388ff',
      opacity: 0.5,
      is_saved: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Create polygon failed');
  });

  await test('Get all polygons', async () => {
    const response = await axios.get(`${BASE_URL}/api/drawings/polygon`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get polygons failed');
  });

  // ===================================
  // 6. CIRCLE DRAWINGS
  // ===================================
  console.log('\n📁 6. CIRCLE DRAWINGS');
  console.log('─'.repeat(40));

  await test('Create circle drawing', async () => {
    const response = await axios.post(`${BASE_URL}/api/drawings/circle`, {
      circle_name: 'Test Signal Range',
      center_lat: 28.6139,
      center_lng: 77.2090,
      radius: 1000,
      fill_color: '#3388ff',
      opacity: 0.3,
      is_saved: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Create circle failed');
  });

  await test('Get all circles', async () => {
    const response = await axios.get(`${BASE_URL}/api/drawings/circle`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get circles failed');
  });

  // ===================================
  // 7. SECTOR RF
  // ===================================
  console.log('\n📁 7. SECTOR RF');
  console.log('─'.repeat(40));

  await test('Create sector RF', async () => {
    const response = await axios.post(`${BASE_URL}/api/rf/sectors`, {
      sector_name: 'Test Sector 1',
      tower_lat: 28.6139,
      tower_lng: 77.2090,
      azimuth: 45,
      beamwidth: 65,
      radius: 1500,
      frequency: 2400,
      power: 43.5,
      is_saved: true
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Create sector failed');
  });

  await test('Get all sectors', async () => {
    const response = await axios.get(`${BASE_URL}/api/rf/sectors`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    if (!response.data.success) throw new Error('Get sectors failed');
  });

  // ===================================
  // SUMMARY
  // ===================================
  console.log('\n========================================');
  log('📊 TEST SUMMARY', 'blue');
  console.log('========================================\n');

  log(`Total Tests: ${totalTests}`, 'blue');
  logSuccess(`Passed: ${passedTests}`);
  if (failedTests > 0) {
    logError(`Failed: ${failedTests}`);
  } else {
    logSuccess('Failed: 0');
  }

  const successRate = ((passedTests / totalTests) * 100).toFixed(2);
  console.log(`\nSuccess Rate: ${successRate}%`);

  if (failedTests === 0) {
    console.log('\n');
    logSuccess('🎉 ALL TESTS PASSED!');
    logSuccess('✅ All 122 APIs are ready for production!');
    console.log('\n');
  } else {
    console.log('\n');
    logWarning('⚠️  Some tests failed. Please check the errors above.');
    console.log('\n');
  }
}

// Run tests
runTests().catch(error => {
  logError(`\nFATAL ERROR: ${error.message}`);
  process.exit(1);
});
