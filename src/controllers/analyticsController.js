const { pool } = require('../config/database');

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard analytics (user/region-wise)
 * @access  Private
 */
const getDashboardAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const analytics = {};

    // Count measurements
    const [measurements] = await pool.query(
      'SELECT COUNT(*) as count FROM distance_measurements WHERE user_id = ?',
      [userId]
    );
    analytics.total_measurements = measurements[0].count;

    // Count polygons
    const [polygons] = await pool.query(
      'SELECT COUNT(*) as count FROM polygon_drawings WHERE user_id = ?',
      [userId]
    );
    analytics.total_polygons = polygons[0].count;

    // Count circles
    const [circles] = await pool.query(
      'SELECT COUNT(*) as count FROM circle_drawings WHERE user_id = ?',
      [userId]
    );
    analytics.total_circles = circles[0].count;

    // Count sectors
    const [sectors] = await pool.query(
      'SELECT COUNT(*) as count FROM sector_rf_data WHERE user_id = ?',
      [userId]
    );
    analytics.total_sectors = sectors[0].count;

    // Count infrastructure
    const [infrastructure] = await pool.query(
      'SELECT COUNT(*) as count FROM infrastructure_items WHERE user_id = ?',
      [userId]
    );
    analytics.total_infrastructure = infrastructure[0].count;

    // Count bookmarks
    const [bookmarks] = await pool.query(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?',
      [userId]
    );
    analytics.total_bookmarks = bookmarks[0].count;

    // Count layers
    const [layers] = await pool.query(
      'SELECT COUNT(*) as count FROM layer_management WHERE user_id = ?',
      [userId]
    );
    analytics.total_layers = layers[0].count;

    // Recent activity (last 7 days)
    const [recent] = await pool.query(
      `SELECT COUNT(*) as count FROM (
        SELECT created_at FROM distance_measurements WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION ALL
        SELECT created_at FROM polygon_drawings WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        UNION ALL
        SELECT created_at FROM infrastructure_items WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ) as recent_activity`,
      [userId, userId, userId]
    );
    analytics.recent_activity_count = recent[0].count;

    res.json({ success: true, analytics });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
};

/**
 * @route   GET /api/analytics/users
 * @desc    Get user analytics (Manager/Admin only)
 * @access  Private (Manager+)
 */
const getUserAnalytics = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (!['admin', 'manager'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Manager or Admin role required'
      });
    }

    const [users] = await pool.query(
      `SELECT
        role,
        COUNT(*) as count,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_count
       FROM users
       GROUP BY role`
    );

    const [recentLogins] = await pool.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    res.json({
      success: true,
      analytics: {
        by_role: users,
        recent_logins: recentLogins[0].count
      }
    });
  } catch (error) {
    console.error('Get user analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user analytics' });
  }
};

/**
 * @route   GET /api/analytics/regions
 * @desc    Get region analytics (user's regions)
 * @access  Private
 */
const getRegionAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's regions with item counts
    const [regions] = await pool.query(
      `SELECT
        r.id,
        r.name,
        r.type,
        COUNT(DISTINCT ii.id) as infrastructure_count,
        COUNT(DISTINCT dm.id) as measurement_count
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       LEFT JOIN infrastructure_items ii ON r.id = ii.region_id AND ii.user_id = ?
       LEFT JOIN distance_measurements dm ON r.id = dm.region_id AND dm.user_id = ?
       WHERE ur.user_id = ?
       GROUP BY r.id, r.name, r.type`,
      [userId, userId, userId]
    );

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Get region analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get region analytics' });
  }
};

/**
 * @route   GET /api/analytics/features
 * @desc    Get feature analytics (user's data)
 * @access  Private
 */
const getFeatureAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get counts by feature type
    const [features] = await pool.query(
      `SELECT
        feature_type,
        COUNT(*) as count
       FROM gis_features
       WHERE user_id = ?
       GROUP BY feature_type`,
      [userId]
    );

    res.json({ success: true, features });
  } catch (error) {
    console.error('Get feature analytics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get feature analytics' });
  }
};

/**
 * @route   POST /api/analytics/track
 * @desc    Track custom analytics event
 * @access  Private
 */
const trackEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { event_name, event_data } = req.body;

    if (!event_name) {
      return res.status(400).json({
        success: false,
        error: 'Event name required'
      });
    }

    await pool.query(
      `INSERT INTO analytics_metrics (user_id, metric_name, metric_value, metadata)
       VALUES (?, ?, 1, ?)`,
      [userId, event_name, event_data ? JSON.stringify(event_data) : null]
    );

    res.json({ success: true, message: 'Event tracked successfully' });
  } catch (error) {
    console.error('Track event error:', error);
    res.status(500).json({ success: false, error: 'Failed to track event' });
  }
};

module.exports = {
  getDashboardAnalytics,
  getUserAnalytics,
  getRegionAnalytics,
  getFeatureAnalytics,
  trackEvent
};
