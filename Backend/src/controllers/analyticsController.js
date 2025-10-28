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

/**
 * @route   GET /api/analytics/performance
 * @desc    Get API performance metrics
 * @access  Private
 */
const getPerformanceMetrics = async (req, res) => {
  try {
    const { timeRange = '24h', groupBy = 'hour' } = req.query;
    const userId = req.user?.id;

    // Calculate time range
    let timeInterval = '24 HOUR';
    let dateFormat = '%Y-%m-%d %H:00:00';

    switch (timeRange) {
      case '1h':
        timeInterval = '1 HOUR';
        dateFormat = '%Y-%m-%d %H:%i:00';
        break;
      case '24h':
        timeInterval = '24 HOUR';
        dateFormat = '%Y-%m-%d %H:00:00';
        break;
      case '7d':
        timeInterval = '7 DAY';
        dateFormat = '%Y-%m-%d';
        break;
      case '30d':
        timeInterval = '30 DAY';
        dateFormat = '%Y-%m-%d';
        break;
    }

    // Get average latency over time
    const [latencyData] = await pool.query(
      `SELECT
        DATE_FORMAT(timestamp, ?) as time_bucket,
        AVG(latency_ms) as avg_latency,
        MIN(latency_ms) as min_latency,
        MAX(latency_ms) as max_latency,
        COUNT(*) as request_count
       FROM api_performance_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       ${userId ? 'AND user_id = ?' : ''}
       GROUP BY time_bucket
       ORDER BY time_bucket ASC`,
      userId ? [dateFormat, userId] : [dateFormat]
    );

    // Get endpoint-wise metrics
    const [endpointMetrics] = await pool.query(
      `SELECT
        endpoint,
        COUNT(*) as request_count,
        AVG(latency_ms) as avg_latency,
        MIN(latency_ms) as min_latency,
        MAX(latency_ms) as max_latency
       FROM api_performance_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       ${userId ? 'AND user_id = ?' : ''}
       GROUP BY endpoint
       ORDER BY request_count DESC
       LIMIT 10`,
      userId ? [userId] : []
    );

    // Get status code distribution
    const [statusCodes] = await pool.query(
      `SELECT
        status_code,
        COUNT(*) as count
       FROM api_performance_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       ${userId ? 'AND user_id = ?' : ''}
       GROUP BY status_code
       ORDER BY status_code ASC`,
      userId ? [userId] : []
    );

    // Calculate overall metrics
    const [overallMetrics] = await pool.query(
      `SELECT
        COUNT(*) as total_requests,
        AVG(latency_ms) as avg_latency,
        MIN(latency_ms) as min_latency,
        MAX(latency_ms) as max_latency,
        SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as failed_requests
       FROM api_performance_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       ${userId ? 'AND user_id = ?' : ''}`,
      userId ? [userId] : []
    );

    res.json({
      success: true,
      data: {
        timeRange,
        latencyOverTime: latencyData,
        topEndpoints: endpointMetrics,
        statusCodeDistribution: statusCodes,
        overall: overallMetrics[0]
      }
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to get performance metrics' });
  }
};

/**
 * @route   GET /api/analytics/usage-trends
 * @desc    Get usage trends over time
 * @access  Private
 */
const getUsageTrends = async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '30d' } = req.query;

    let timeInterval = '30 DAY';
    let dateFormat = '%Y-%m-%d';

    switch (timeRange) {
      case '7d':
        timeInterval = '7 DAY';
        break;
      case '30d':
        timeInterval = '30 DAY';
        break;
      case '90d':
        timeInterval = '90 DAY';
        break;
    }

    // Get activity trends for different feature types
    const [trends] = await pool.query(
      `SELECT
        DATE_FORMAT(created_at, ?) as date,
        'distance' as type,
        COUNT(*) as count
       FROM distance_measurements
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       GROUP BY date

       UNION ALL

       SELECT
        DATE_FORMAT(created_at, ?) as date,
        'polygon' as type,
        COUNT(*) as count
       FROM polygon_drawings
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       GROUP BY date

       UNION ALL

       SELECT
        DATE_FORMAT(created_at, ?) as date,
        'elevation' as type,
        COUNT(*) as count
       FROM elevation_profiles
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       GROUP BY date

       UNION ALL

       SELECT
        DATE_FORMAT(created_at, ?) as date,
        'circle' as type,
        COUNT(*) as count
       FROM circle_drawings
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       GROUP BY date

       UNION ALL

       SELECT
        DATE_FORMAT(created_at, ?) as date,
        'sector_rf' as type,
        COUNT(*) as count
       FROM sector_rf_data
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       GROUP BY date

       UNION ALL

       SELECT
        DATE_FORMAT(created_at, ?) as date,
        'infrastructure' as type,
        COUNT(*) as count
       FROM infrastructure_items
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ${timeInterval})
       GROUP BY date

       ORDER BY date ASC`,
      [dateFormat, userId, dateFormat, userId, dateFormat, userId, dateFormat, userId, dateFormat, userId, dateFormat, userId]
    );

    // Transform data for frontend
    const trendsByDate = {};
    trends.forEach(row => {
      if (!trendsByDate[row.date]) {
        trendsByDate[row.date] = {
          date: row.date,
          distance: 0,
          polygon: 0,
          elevation: 0,
          circle: 0,
          sector_rf: 0,
          infrastructure: 0
        };
      }
      trendsByDate[row.date][row.type] = parseInt(row.count);
    });

    const formattedTrends = Object.values(trendsByDate);

    res.json({
      success: true,
      data: {
        timeRange,
        trends: formattedTrends
      }
    });
  } catch (error) {
    console.error('Get usage trends error:', error);
    res.status(500).json({ success: false, error: 'Failed to get usage trends' });
  }
};

/**
 * @route   GET /api/analytics/system-health
 * @desc    Get system health metrics
 * @access  Private (Admin only)
 */
const getSystemHealth = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required'
      });
    }

    // Get database size
    const [dbSize] = await pool.query(
      `SELECT
        SUM(data_length + index_length) / 1024 / 1024 as size_mb
       FROM information_schema.TABLES
       WHERE table_schema = ?`,
      [process.env.DB_NAME]
    );

    // Get table row counts
    const [tableCounts] = await pool.query(
      `SELECT
        table_name,
        table_rows
       FROM information_schema.TABLES
       WHERE table_schema = ?
       ORDER BY table_rows DESC
       LIMIT 10`,
      [process.env.DB_NAME]
    );

    // Get recent API error rate
    const [errorRate] = await pool.query(
      `SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_requests
       FROM api_performance_logs
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`
    );

    const errorPercentage = errorRate[0].total_requests > 0
      ? (errorRate[0].error_requests / errorRate[0].total_requests) * 100
      : 0;

    // Get active connections (approximation)
    const [connections] = await pool.query('SHOW STATUS LIKE "Threads_connected"');

    res.json({
      success: true,
      data: {
        database: {
          size_mb: parseFloat(dbSize[0].size_mb).toFixed(2),
          tables: tableCounts
        },
        api: {
          error_rate: errorPercentage.toFixed(2) + '%',
          total_requests_last_hour: errorRate[0].total_requests
        },
        connections: parseInt(connections[0].Value)
      }
    });
  } catch (error) {
    console.error('Get system health error:', error);
    res.status(500).json({ success: false, error: 'Failed to get system health metrics' });
  }
};

/**
 * @route   GET /api/analytics/recent-activity
 * @desc    Get recent user activity
 * @access  Private (Admin/Manager see all, Users see own)
 * @query   limit - Number of activities to return (default: 20)
 */
const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { limit = 20 } = req.query;

    // Admin/Manager can see all activities, regular users see only their own
    const isAdminOrManager = ['admin', 'manager'].includes(userRole);

    // Build activities query
    const activities = [];

    // Helper function to get user info
    const getUserInfo = async (userIds) => {
      if (userIds.length === 0) return {};

      const [users] = await pool.query(
        `SELECT id, full_name, role FROM users WHERE id IN (?)`,
        [userIds]
      );

      const userMap = {};
      users.forEach(u => {
        userMap[u.id] = { name: u.full_name, role: u.role };
      });
      return userMap;
    };

    // Get distance measurements
    const [measurements] = await pool.query(
      `SELECT
        dm.id,
        dm.user_id,
        dm.created_at,
        dm.total_distance,
        r.name as region_name
       FROM distance_measurements dm
       LEFT JOIN regions r ON dm.region_id = r.id
       WHERE ${isAdminOrManager ? '1=1' : 'dm.user_id = ?'}
       ORDER BY dm.created_at DESC
       LIMIT ?`,
      isAdminOrManager ? [parseInt(limit)] : [userId, parseInt(limit)]
    );

    // Get polygon drawings
    const [polygons] = await pool.query(
      `SELECT
        pd.id,
        pd.user_id,
        pd.created_at,
        pd.area,
        r.name as region_name
       FROM polygon_drawings pd
       LEFT JOIN regions r ON pd.region_id = r.id
       WHERE ${isAdminOrManager ? '1=1' : 'pd.user_id = ?'}
       ORDER BY pd.created_at DESC
       LIMIT ?`,
      isAdminOrManager ? [parseInt(limit)] : [userId, parseInt(limit)]
    );

    // Get infrastructure items
    const [infrastructure] = await pool.query(
      `SELECT
        ii.id,
        ii.user_id,
        ii.created_at,
        ii.item_type,
        ii.item_name,
        r.name as region_name
       FROM infrastructure_items ii
       LEFT JOIN regions r ON ii.region_id = r.id
       WHERE ${isAdminOrManager ? '1=1' : 'ii.user_id = ?'}
       ORDER BY ii.created_at DESC
       LIMIT ?`,
      isAdminOrManager ? [parseInt(limit)] : [userId, parseInt(limit)]
    );

    // Get circle drawings
    const [circles] = await pool.query(
      `SELECT
        cd.id,
        cd.user_id,
        cd.created_at,
        cd.radius,
        r.name as region_name
       FROM circle_drawings cd
       LEFT JOIN regions r ON cd.region_id = r.id
       WHERE ${isAdminOrManager ? '1=1' : 'cd.user_id = ?'}
       ORDER BY cd.created_at DESC
       LIMIT ?`,
      isAdminOrManager ? [parseInt(limit)] : [userId, parseInt(limit)]
    );

    // Get sector RF data
    const [sectors] = await pool.query(
      `SELECT
        srf.id,
        srf.user_id,
        srf.created_at,
        srf.sector_name,
        r.name as region_name
       FROM sector_rf_data srf
       LEFT JOIN regions r ON srf.region_id = r.id
       WHERE ${isAdminOrManager ? '1=1' : 'srf.user_id = ?'}
       ORDER BY srf.created_at DESC
       LIMIT ?`,
      isAdminOrManager ? [parseInt(limit)] : [userId, parseInt(limit)]
    );

    // Combine all activities
    const allActivities = [];

    measurements.forEach(m => {
      allActivities.push({
        id: `measurement-${m.id}`,
        user_id: m.user_id,
        timestamp: m.created_at,
        action: 'Completed Distance Measurement',
        details: `${m.total_distance ? parseFloat(m.total_distance).toFixed(2) + ' km' : 'Distance calculated'}`,
        region: m.region_name || 'Unknown',
        type: 'measurement'
      });
    });

    polygons.forEach(p => {
      allActivities.push({
        id: `polygon-${p.id}`,
        user_id: p.user_id,
        timestamp: p.created_at,
        action: 'Completed Polygon Drawing',
        details: `${p.area ? parseFloat(p.area).toFixed(2) + ' m²' : 'Area calculated'}`,
        region: p.region_name || 'Unknown',
        type: 'polygon'
      });
    });

    infrastructure.forEach(i => {
      allActivities.push({
        id: `infrastructure-${i.id}`,
        user_id: i.user_id,
        timestamp: i.created_at,
        action: `Added ${i.item_type || 'Infrastructure'}`,
        details: i.item_name || 'Infrastructure item',
        region: i.region_name || 'Unknown',
        type: 'infrastructure'
      });
    });

    circles.forEach(c => {
      allActivities.push({
        id: `circle-${c.id}`,
        user_id: c.user_id,
        timestamp: c.created_at,
        action: 'Created Coverage Circle',
        details: `${c.radius ? parseFloat(c.radius).toFixed(2) + ' m radius' : 'Circle created'}`,
        region: c.region_name || 'Unknown',
        type: 'circle'
      });
    });

    sectors.forEach(s => {
      allActivities.push({
        id: `sector-${s.id}`,
        user_id: s.user_id,
        timestamp: s.created_at,
        action: 'Added RF Sector',
        details: s.sector_name || 'Sector configured',
        region: s.region_name || 'Unknown',
        type: 'sector'
      });
    });

    // Sort all activities by timestamp (most recent first)
    allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit to requested number
    const limitedActivities = allActivities.slice(0, parseInt(limit));

    // Get user information for all activities
    const userIds = [...new Set(limitedActivities.map(a => a.user_id))];
    const userMap = await getUserInfo(userIds);

    // Format activities with user information
    const formattedActivities = limitedActivities.map(activity => ({
      id: activity.id,
      user: userMap[activity.user_id]?.name || 'Unknown User',
      userRole: userMap[activity.user_id]?.role || 'user',
      action: activity.action,
      details: activity.details,
      region: activity.region,
      timestamp: activity.timestamp,
      type: activity.type
    }));

    res.json({
      success: true,
      data: {
        activities: formattedActivities,
        count: formattedActivities.length,
        viewingAsRole: userRole
      }
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to get recent activity' });
  }
};

/**
 * @route   GET /api/analytics/user-stats
 * @desc    Get real-time user statistics
 * @access  Private (Admin/Manager only)
 */
const getUserStats = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (!['admin', 'manager'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Manager or Admin role required'
      });
    }

    // Get total user count
    const [totalUsers] = await pool.query(
      'SELECT COUNT(*) as count FROM users'
    );

    // Get active users (using is_online flag)
    const [onlineUsers] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_online = TRUE'
    );

    // Get list of currently online users with details
    const [onlineUsersList] = await pool.query(
      `SELECT
        id,
        username,
        full_name,
        email,
        role,
        last_login,
        TIMESTAMPDIFF(MINUTE, last_login, NOW()) as minutes_since_login
       FROM users
       WHERE is_online = TRUE
       ORDER BY last_login DESC`
    );

    console.log('🔍 Online Users Query Result:', onlineUsersList);

    // Get users by role
    const [usersByRole] = await pool.query(
      `SELECT
        role,
        COUNT(*) as count
       FROM users
       GROUP BY role`
    );

    // Get active users (is_active = true)
    const [activeUsers] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE is_active = true'
    );

    // Get user activity trend (last 7 days)
    const [activityTrend] = await pool.query(
      `SELECT
        DATE(last_login) as date,
        COUNT(DISTINCT id) as active_users
       FROM users
       WHERE last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(last_login)
       ORDER BY date ASC`
    );

    // Get new users in last 7 days
    const [newUsers] = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
    );

    // Format user stats by role
    const roleStats = {};
    usersByRole.forEach(row => {
      roleStats[row.role] = parseInt(row.count);
    });

    const responseData = {
      success: true,
      data: {
        total: parseInt(totalUsers[0].count),
        currentlyOnline: parseInt(onlineUsers[0].count),
        onlineUsers: onlineUsersList.map(user => ({
          id: user.id,
          name: user.full_name || user.username,
          username: user.username,
          email: user.email,
          role: user.role,
          lastLogin: user.last_login,
          minutesSinceLogin: user.minutes_since_login
        })),
        active: parseInt(activeUsers[0].count),
        newThisWeek: parseInt(newUsers[0].count),
        byRole: {
          admin: roleStats.admin || 0,
          manager: roleStats.manager || 0,
          engineer: roleStats.engineer || 0,
          viewer: roleStats.viewer || 0
        },
        activityTrend: activityTrend.map(row => ({
          date: row.date,
          activeUsers: parseInt(row.active_users)
        }))
      }
    };

    console.log('📤 Sending Response - Online Users Count:', responseData.data.onlineUsers.length);
    console.log('📤 Sending Response - Online Users:', responseData.data.onlineUsers);

    res.json(responseData);
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user statistics' });
  }
};

/**
 * @route   GET /api/analytics/system-overview
 * @desc    Get system overview metrics (Network Health, Coverage, Utilization)
 * @access  Private
 */
const getSystemOverview = async (req, res) => {
  try {
    // Get total infrastructure count
    const [totalInfra] = await pool.query(
      'SELECT COUNT(*) as total FROM infrastructure_items'
    );

    // Get active infrastructure
    const [activeInfra] = await pool.query(
      'SELECT COUNT(*) as active FROM infrastructure_items WHERE status = "Active"'
    );

    // Get inactive/problematic infrastructure
    const [inactiveInfra] = await pool.query(
      `SELECT COUNT(*) as inactive FROM infrastructure_items
       WHERE status IN ("Inactive", "Maintenance", "Damaged")`
    );

    // Get regions with coverage
    const [totalRegions] = await pool.query(
      'SELECT COUNT(*) as total FROM regions WHERE is_active = true'
    );

    const [regionsWithInfra] = await pool.query(
      `SELECT COUNT(DISTINCT region_id) as covered
       FROM infrastructure_items
       WHERE region_id IS NOT NULL AND status = "Active"`
    );

    // Calculate metrics
    const total = parseInt(totalInfra[0].total);
    const active = parseInt(activeInfra[0].active);
    const inactive = parseInt(inactiveInfra[0].inactive);

    // Network Health: percentage of active infrastructure
    const networkHealth = total > 0 ? ((active / total) * 100).toFixed(1) : 0;

    // Coverage: percentage of regions with active infrastructure
    const totalRegionsCount = parseInt(totalRegions[0].total);
    const coveredRegions = parseInt(regionsWithInfra[0].covered);
    const coverage = totalRegionsCount > 0 ? ((coveredRegions / totalRegionsCount) * 100).toFixed(1) : 0;

    // Utilization: based on infrastructure with UPS and proper power source
    const [utilizationData] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ups_availability = true THEN 1 ELSE 0 END) as with_ups,
        SUM(CASE WHEN power_source IN ('Grid', 'Hybrid') THEN 1 ELSE 0 END) as proper_power
       FROM infrastructure_items
       WHERE status = "Active"`
    );

    const utilTotal = parseInt(utilizationData[0].total);
    const withUps = parseInt(utilizationData[0].with_ups);
    const properPower = parseInt(utilizationData[0].proper_power);

    // Utilization: average of UPS coverage and proper power source
    const upsPercentage = utilTotal > 0 ? (withUps / utilTotal) * 100 : 0;
    const powerPercentage = utilTotal > 0 ? (properPower / utilTotal) * 100 : 0;
    const utilization = ((upsPercentage + powerPercentage) / 2).toFixed(1);

    // Get recent system alerts (maintenance due, inactive items)
    const [maintenanceDue] = await pool.query(
      `SELECT COUNT(*) as count
       FROM infrastructure_items
       WHERE maintenance_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
    );

    res.json({
      success: true,
      data: {
        networkHealth: parseFloat(networkHealth),
        coverage: parseFloat(coverage),
        utilization: parseFloat(utilization),
        details: {
          totalInfrastructure: total,
          activeInfrastructure: active,
          inactiveInfrastructure: inactive,
          totalRegions: totalRegionsCount,
          coveredRegions: coveredRegions,
          maintenanceDue: parseInt(maintenanceDue[0].count)
        }
      }
    });
  } catch (error) {
    console.error('Get system overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to get system overview' });
  }
};

/**
 * @route   GET /api/analytics/infrastructure-stats
 * @desc    Get infrastructure statistics (all users can see)
 * @access  Private
 */
const getInfrastructureStats = async (req, res) => {
  try {
    // Get total counts by item type
    const [itemTypeCounts] = await pool.query(
      `SELECT
        item_type,
        COUNT(*) as count
       FROM infrastructure_items
       GROUP BY item_type`
    );

    // Get total counts by status
    const [statusCounts] = await pool.query(
      `SELECT
        status,
        COUNT(*) as count
       FROM infrastructure_items
       GROUP BY status`
    );

    // Get total counts by structure type
    const [structureTypeCounts] = await pool.query(
      `SELECT
        structure_type,
        COUNT(*) as count
       FROM infrastructure_items
       GROUP BY structure_type`
    );

    // Get total counts by power source
    const [powerSourceCounts] = await pool.query(
      `SELECT
        power_source,
        COUNT(*) as count
       FROM infrastructure_items
       GROUP BY power_source`
    );

    // Get total infrastructure count
    const [totalCount] = await pool.query(
      'SELECT COUNT(*) as total FROM infrastructure_items'
    );

    // Get active/inactive counts
    const [activeInactive] = await pool.query(
      `SELECT
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive
       FROM infrastructure_items`
    );

    // Get rental statistics
    const [rentalStats] = await pool.query(
      `SELECT
        SUM(CASE WHEN is_rented = TRUE THEN 1 ELSE 0 END) as rented,
        SUM(CASE WHEN is_rented = FALSE THEN 1 ELSE 0 END) as owned,
        SUM(rent_amount) as total_rent_amount
       FROM infrastructure_items`
    );

    // Get UPS availability stats
    const [upsStats] = await pool.query(
      `SELECT
        SUM(CASE WHEN ups_availability = TRUE THEN 1 ELSE 0 END) as with_ups,
        SUM(CASE WHEN ups_availability = FALSE THEN 1 ELSE 0 END) as without_ups
       FROM infrastructure_items`
    );

    // Get maintenance due items (within next 30 days)
    const [maintenanceDue] = await pool.query(
      `SELECT COUNT(*) as count
       FROM infrastructure_items
       WHERE maintenance_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
    );

    // Get recent additions (last 7 days)
    const [recentAdditions] = await pool.query(
      `SELECT COUNT(*) as count
       FROM infrastructure_items
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    // Format the counts into easy-to-use objects
    const byItemType = {};
    itemTypeCounts.forEach(row => {
      byItemType[row.item_type] = parseInt(row.count);
    });

    const byStatus = {};
    statusCounts.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });

    const byStructureType = {};
    structureTypeCounts.forEach(row => {
      byStructureType[row.structure_type] = parseInt(row.count);
    });

    const byPowerSource = {};
    powerSourceCounts.forEach(row => {
      byPowerSource[row.power_source] = parseInt(row.count);
    });

    res.json({
      success: true,
      data: {
        total: parseInt(totalCount[0].total),
        byItemType: {
          POP: byItemType.POP || 0,
          SubPOP: byItemType.SubPOP || 0,
          Tower: byItemType.Tower || 0,
          Building: byItemType.Building || 0,
          Equipment: byItemType.Equipment || 0,
          Other: byItemType.Other || 0
        },
        byStatus: {
          Active: byStatus.Active || 0,
          Inactive: byStatus.Inactive || 0,
          Maintenance: byStatus.Maintenance || 0,
          Planned: byStatus.Planned || 0,
          RFS: byStatus.RFS || 0,
          Damaged: byStatus.Damaged || 0
        },
        byStructureType: {
          Tower: byStructureType.Tower || 0,
          Building: byStructureType.Building || 0,
          Ground: byStructureType.Ground || 0,
          Rooftop: byStructureType.Rooftop || 0,
          Other: byStructureType.Other || 0
        },
        byPowerSource: {
          Grid: byPowerSource.Grid || 0,
          Solar: byPowerSource.Solar || 0,
          Generator: byPowerSource.Generator || 0,
          Hybrid: byPowerSource.Hybrid || 0,
          Other: byPowerSource.Other || 0
        },
        summary: {
          active: parseInt(activeInactive[0].active) || 0,
          inactive: parseInt(activeInactive[0].inactive) || 0,
          rented: parseInt(rentalStats[0].rented) || 0,
          owned: parseInt(rentalStats[0].owned) || 0,
          totalRentAmount: parseFloat(rentalStats[0].total_rent_amount) || 0,
          withUPS: parseInt(upsStats[0].with_ups) || 0,
          withoutUPS: parseInt(upsStats[0].without_ups) || 0,
          maintenanceDue: parseInt(maintenanceDue[0].count) || 0,
          recentAdditions: parseInt(recentAdditions[0].count) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get infrastructure stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get infrastructure statistics' });
  }
};

module.exports = {
  getDashboardAnalytics,
  getUserAnalytics,
  getRegionAnalytics,
  getFeatureAnalytics,
  trackEvent,
  getPerformanceMetrics,
  getUsageTrends,
  getSystemHealth,
  getRecentActivity,
  getInfrastructureStats,
  getUserStats,
  getSystemOverview
};
