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
  getSearchHistory,
  deleteSearchHistory
};
