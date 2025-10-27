const { pool } = require('../config/database');

/**
 * @route   GET /api/search/global
 * @desc    Global search across user's data
 * @access  Private
 */
const globalSearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = `%${q}%`;
    const results = {};

    // Search in infrastructure
    const [infrastructure] = await pool.query(
      `SELECT id, item_name, item_type, latitude, longitude
       FROM infrastructure_items
       WHERE user_id = ? AND item_name LIKE ?
       LIMIT 10`,
      [userId, searchTerm]
    );
    results.infrastructure = infrastructure;

    // Search in measurements
    const [measurements] = await pool.query(
      `SELECT id, measurement_name, total_distance
       FROM distance_measurements
       WHERE user_id = ? AND measurement_name LIKE ?
       LIMIT 10`,
      [userId, searchTerm]
    );
    results.measurements = measurements;

    // Search in bookmarks
    const [bookmarks] = await pool.query(
      `SELECT id, name, latitude, longitude
       FROM bookmarks
       WHERE user_id = ? AND name LIKE ?
       LIMIT 10`,
      [userId, searchTerm]
    );
    results.bookmarks = bookmarks;

    // Search in layers
    const [layers] = await pool.query(
      `SELECT id, layer_name, layer_type
       FROM layer_management
       WHERE user_id = ? AND layer_name LIKE ?
       LIMIT 10`,
      [userId, searchTerm]
    );
    results.layers = layers;

    // Save search history
    await pool.query(
      'INSERT INTO search_history (user_id, query) VALUES (?, ?)',
      [userId, q]
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
};

/**
 * @route   GET /api/search/users
 * @desc    Search users (region-filtered)
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = `%${q}%`;

    // Get user's regions
    const [userRegions] = await pool.query(
      'SELECT region_id FROM user_regions WHERE user_id = ?',
      [userId]
    );

    const regionIds = userRegions.map(r => r.region_id);

    if (regionIds.length === 0) {
      return res.json({ success: true, users: [] });
    }

    // Search users in same regions
    const [users] = await pool.query(
      `SELECT DISTINCT u.id, u.username, u.email, u.full_name, u.role
       FROM users u
       INNER JOIN user_regions ur ON u.id = ur.user_id
       WHERE ur.region_id IN (?) AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)
       AND u.is_active = true
       LIMIT 20`,
      [regionIds, searchTerm, searchTerm, searchTerm]
    );

    res.json({ success: true, users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, error: 'Failed to search users' });
  }
};

/**
 * @route   GET /api/search/regions
 * @desc    Search regions (user's regions only)
 * @access  Private
 */
const searchRegions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = `%${q}%`;

    const [regions] = await pool.query(
      `SELECT DISTINCT r.id, r.name, r.code, r.type
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND (r.name LIKE ? OR r.code LIKE ?)
       LIMIT 20`,
      [userId, searchTerm, searchTerm]
    );

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Search regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to search regions' });
  }
};

/**
 * @route   GET /api/search/features
 * @desc    Search GIS features
 * @access  Private
 */
const searchFeatures = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = `%${q}%`;

    const [features] = await pool.query(
      `SELECT id, name, feature_type, latitude, longitude
       FROM gis_features
       WHERE user_id = ? AND (name LIKE ? OR description LIKE ?)
       LIMIT 20`,
      [userId, searchTerm, searchTerm]
    );

    res.json({ success: true, features });
  } catch (error) {
    console.error('Search features error:', error);
    res.status(500).json({ success: false, error: 'Failed to search features' });
  }
};

/**
 * @route   GET /api/search/saved-data
 * @desc    Search saved GIS data (admin can search by user)
 * @access  Private
 */
const searchSavedData = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    const { q, userId: targetUserId } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = `%${q}%`;

    // Determine which user's data to search
    let searchUserId = currentUserId;

    // Admin and manager can search other users' data
    if ((currentUserRole === 'admin' || currentUserRole === 'manager') && targetUserId) {
      searchUserId = parseInt(targetUserId);
    }

    const results = {
      infrastructure: [],
      measurements: [],
      polygons: [],
      circles: [],
      elevations: [],
      sectors: []
    };

    // Search Infrastructure
    try {
      const [infrastructure] = await pool.query(
        `SELECT id, item_name as name, item_type as type, latitude, longitude,
                address_street, address_city, address_state, address_pincode, notes, created_at, user_id
         FROM infrastructure_items
         WHERE user_id = ? AND (item_name LIKE ? OR notes LIKE ?)
         ORDER BY created_at DESC
         LIMIT 20`,
        [searchUserId, searchTerm, searchTerm]
      );
      results.infrastructure = infrastructure;
    } catch (error) {
      console.error('❌ Error searching infrastructure:', error.message);
      results.infrastructure = [];
    }

    // Search Distance Measurements
    const [measurements] = await pool.query(
      `SELECT id, measurement_name as name, total_distance, points, created_at, user_id
       FROM distance_measurements
       WHERE user_id = ? AND measurement_name LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [searchUserId, searchTerm]
    );
    // Parse JSON points field
    results.measurements = measurements.map(m => ({
      ...m,
      points: typeof m.points === 'string' ? JSON.parse(m.points) : (m.points || [])
    }));

    // Search Polygon Drawings
    const [polygons] = await pool.query(
      `SELECT id, polygon_name as name, vertices, area, perimeter,
              stroke_color, fill_color, opacity, created_at, user_id
       FROM polygon_drawings
       WHERE user_id = ? AND polygon_name LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [searchUserId, searchTerm]
    );
    // Parse JSON vertices field and add as coordinates
    results.polygons = polygons.map(p => ({
      ...p,
      vertices: typeof p.vertices === 'string' ? JSON.parse(p.vertices) : (p.vertices || []),
      coordinates: typeof p.vertices === 'string' ? JSON.parse(p.vertices) : (p.vertices || [])
    }));

    // Search Circle Drawings
    const [circles] = await pool.query(
      `SELECT id, circle_name as name, center_lat, center_lng, radius, area,
              stroke_color, fill_color, opacity, created_at, user_id
       FROM circle_drawings
       WHERE user_id = ? AND circle_name LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [searchUserId, searchTerm]
    );
    // Construct center object from lat/lng fields
    results.circles = circles.map(c => ({
      ...c,
      center: c.center_lat && c.center_lng ? { lat: c.center_lat, lng: c.center_lng } : null
    }));

    // Search Elevation Profiles
    const [elevations] = await pool.query(
      `SELECT id, profile_name as name, start_point, end_point, elevation_data,
              total_distance, min_elevation, max_elevation, elevation_gain,
              elevation_loss, notes, created_at, user_id
       FROM elevation_profiles
       WHERE user_id = ? AND profile_name LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [searchUserId, searchTerm]
    );
    // No need to parse JSON fields here - they will be parsed on the frontend
    results.elevations = elevations;

    // Search RF Sectors
    const [sectors] = await pool.query(
      `SELECT id, sector_name as name, tower_lat, tower_lng, radius, start_angle, end_angle,
              stroke_color, fill_color, opacity, azimuth, beamwidth, created_at, user_id
       FROM sector_rf_data
       WHERE user_id = ? AND sector_name LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [searchUserId, searchTerm]
    );
    // Construct center object from tower lat/lng fields
    results.sectors = sectors.map(s => ({
      ...s,
      center: s.tower_lat && s.tower_lng ? { lat: s.tower_lat, lng: s.tower_lng } : null
    }));

    // Get user info if admin/manager searching another user's data
    let userInfo = null;
    if ((currentUserRole === 'admin' || currentUserRole === 'manager') && searchUserId !== currentUserId) {
      const [users] = await pool.query(
        'SELECT id, username, full_name, email FROM users WHERE id = ?',
        [searchUserId]
      );
      userInfo = users[0] || null;
    }

    res.json({
      success: true,
      results,
      searchedUser: userInfo,
      totalResults: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    });
  } catch (error) {
    console.error('Search saved data error:', error);
    res.status(500).json({ success: false, error: 'Failed to search saved data' });
  }
};

/**
 * @route   GET /api/search/users-list
 * @desc    Get list of users for admin/manager to filter search
 * @access  Private (Admin/Manager)
 */
const getUsersList = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin or Manager only.'
      });
    }

    const [users] = await pool.query(
      `SELECT id, username, full_name, email, role
       FROM users
       WHERE is_active = true
       ORDER BY full_name, username`
    );

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users list error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users list' });
  }
};

/**
 * @route   GET /api/search/history
 * @desc    Get user's search history
 * @access  Private
 */
const getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const [history] = await pool.query(
      `SELECT id, query, created_at
       FROM search_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, parseInt(limit)]
    );

    res.json({ success: true, history });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get search history' });
  }
};

/**
 * @route   DELETE /api/search/history/:id
 * @desc    Delete search history entry
 * @access  Private
 */
const deleteSearchHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query('DELETE FROM search_history WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Search history entry deleted' });
  } catch (error) {
    console.error('Delete search history error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete search history' });
  }
};

module.exports = {
  globalSearch,
  searchUsers,
  searchRegions,
  searchFeatures,
  searchSavedData,
  getUsersList,
  getSearchHistory,
  deleteSearchHistory
};
