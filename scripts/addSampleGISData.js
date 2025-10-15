const { pool } = require('../src/config/database');

async function addSampleData() {
  try {
    console.log('🔄 Adding sample GIS data...');

    // Get first user (assuming admin with ID 1)
    const [users] = await pool.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) {
      console.error('❌ No users found in database');
      return;
    }

    const userId = users[0].id;
    console.log('✅ Using user ID:', userId);

    // Add Distance Measurement
    const [distanceResult] = await pool.query(
      `INSERT INTO distance_measurements 
       (user_id, measurement_name, points, total_distance, unit, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Sample Distance Measurement',
        JSON.stringify([
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6149, lng: 77.2100 },
          { lat: 28.6159, lng: 77.2110 }
        ]),
        1245.67,
        'meters',
        'This is a sample distance measurement',
        true
      ]
    );
    console.log('✅ Added distance measurement, ID:', distanceResult.insertId);

    // Add Polygon Drawing
    const [polygonResult] = await pool.query(
      `INSERT INTO polygon_drawings
       (user_id, polygon_name, coordinates, area, perimeter, fill_color, stroke_color, opacity, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Sample Polygon',
        JSON.stringify([
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6149, lng: 77.2090 },
          { lat: 28.6149, lng: 77.2110 },
          { lat: 28.6139, lng: 77.2110 }
        ]),
        50000.5,
        900.0,
        '#3388ff',
        '#3388ff',
        0.5,
        'Sample polygon area',
        true
      ]
    );
    console.log('✅ Added polygon drawing, ID:', polygonResult.insertId);

    // Add Circle Drawing
    const [circleResult] = await pool.query(
      `INSERT INTO circle_drawings
       (user_id, circle_name, center_lat, center_lng, radius, fill_color, stroke_color, opacity, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Sample Circle',
        28.6139,
        77.2090,
        500,
        '#ff6b6b',
        '#ff6b6b',
        0.4,
        'Sample circle coverage',
        true
      ]
    );
    console.log('✅ Added circle drawing, ID:', circleResult.insertId);

    // Add Sector RF
    const [sectorResult] = await pool.query(
      `INSERT INTO sector_rf_data
       (user_id, sector_name, tower_lat, tower_lng, azimuth, beamwidth, radius, frequency, power, fill_color, stroke_color, opacity, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Sample RF Sector',
        28.6139,
        77.2090,
        45,
        65,
        1000,
        1800,
        250,
        '#ffa500',
        '#ffa500',
        0.5,
        'Sample RF coverage sector',
        true
      ]
    );
    console.log('✅ Added RF sector, ID:', sectorResult.insertId);

    // Add Elevation Profile
    const elevationData = [
      { distance: 0, elevation: 250, lat: 28.6139, lng: 77.2090 },
      { distance: 100, elevation: 255, lat: 28.6140, lng: 77.2095 },
      { distance: 200, elevation: 260, lat: 28.6141, lng: 77.2100 },
      { distance: 300, elevation: 265, lat: 28.6142, lng: 77.2105 },
      { distance: 400, elevation: 270, lat: 28.6143, lng: 77.2110 }
    ];

    const [elevationResult] = await pool.query(
      `INSERT INTO elevation_profiles
       (user_id, profile_name, start_point, end_point, elevation_data, total_distance, max_elevation, min_elevation, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        'Sample Elevation Profile',
        JSON.stringify({ lat: 28.6139, lng: 77.2090 }),
        JSON.stringify({ lat: 28.6143, lng: 77.2110 }),
        JSON.stringify(elevationData),
        400,
        270,
        250,
        'Sample elevation profile',
        true
      ]
    );
    console.log('✅ Added elevation profile, ID:', elevationResult.insertId);

    console.log('\n🎉 Sample data added successfully!');
    console.log('📊 Summary:');
    console.log('  - 1 Distance Measurement');
    console.log('  - 1 Polygon Drawing');
    console.log('  - 1 Circle Drawing');
    console.log('  - 1 RF Sector');
    console.log('  - 1 Elevation Profile');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
    process.exit(1);
  }
}

addSampleData();
