const { pool } = require('../config/database');
const { logAudit } = require('./auditController');
const { createNotification } = require('./notificationController');

/**
 * @route   GET /api/users/:id/session-stats
 * @desc    Get user session statistics for dashboard modal
 * @access  Private (Admin)
 */
const getUserSessionStats = async (req, res) => {
  try {
    const { id } = req.params;

    // Get active sessions count
    const [activeSessions] = await pool.query(
      `SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ? AND expires_at > NOW()`,
      [id]
    );

    // Get total actions in last 7 days from audit logs
    const [actionCount] = await pool.query(
      `SELECT COUNT(*) as count FROM audit_logs
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [id]
    );

    // Get total time today (sum of session durations)
    const [timeToday] = await pool.query(
      `SELECT
         SUM(TIMESTAMPDIFF(MINUTE, created_at,
           CASE
             WHEN expires_at < NOW() THEN expires_at
             ELSE COALESCE(last_activity, NOW())
           END
         )) as total_minutes
       FROM user_sessions WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [id]
    );

    // Get current active session details
    const [currentSession] = await pool.query(
      `SELECT ip_address, user_agent, created_at, last_activity
       FROM user_sessions WHERE user_id = ? AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [id]
    );

    const totalMinutes = timeToday[0].total_minutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    res.json({
      success: true,
      stats: {
        activeSessions: activeSessions[0].count,
        totalActions: actionCount[0].count,
        totalTimeToday: {
          raw: totalMinutes,
          formatted: `${hours}h ${minutes}m`
        },
        currentSession: currentSession[0] || null
      }
    });

  } catch (error) {
    console.error('Get user session stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session statistics'
    });
  }
};

/**
 * @route   POST /api/users/:id/force-logout
 * @desc    Force logout all sessions for a user (Admin only)
 * @access  Private (Admin)
 */
const forceLogoutUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Get user details
    const [users] = await pool.query(
      'SELECT id, username, full_name, email FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Mark all active sessions as expired (force logout)
    const [result] = await pool.query(
      `UPDATE user_sessions
       SET expires_at = NOW()
       WHERE user_id = ? AND expires_at > NOW()`,
      [id]
    );

    // Set user offline
    await pool.query(
      'UPDATE users SET is_online = FALSE WHERE id = ?',
      [id]
    );

    // Send notification to user
    await createNotification(
      id,
      'security_alert',
      '🚪 Session Terminated',
      'Your session has been terminated by an administrator for security reasons. Please log in again if you need access.',
      {
        data: {
          terminatedBy: req.user.full_name || req.user.username,
          reason: 'Admin forced logout',
          sessionsTerminated: result.affectedRows
        },
        priority: 'high',
        action_url: '/login',
        action_label: 'Login Again'
      }
    );

    // Log audit
    await logAudit(adminId, 'FORCE_LOGOUT', 'user', id, {
      username: user.username,
      sessions_terminated: result.affectedRows,
      admin: req.user.username
    }, req);

    // Send WebSocket notification to user for immediate logout
    const websocketServer = require('../services/websocketServer');
    const wsSent = websocketServer.forceLogoutUser(id, `Your session was terminated by admin: ${req.user.username}`);

    console.log(`✅ Admin ${req.user.username} forced logout ${result.affectedRows} session(s) for user ${user.username}`);
    console.log(`📡 WebSocket notification ${wsSent ? 'sent' : 'not sent'} (user ${wsSent ? 'online' : 'offline'})`);

    res.json({
      success: true,
      message: `Successfully logged out ${result.affectedRows} active session(s) for ${user.username}`,
      sessionsTerminated: result.affectedRows,
      websocketNotificationSent: wsSent
    });

  } catch (error) {
    console.error('Force logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force logout user'
    });
  }
};

/**
 * @route   POST /api/admin/send-message
 * @desc    Send message from admin to user via notification
 * @access  Private (Admin)
 */
const sendAdminMessage = async (req, res) => {
  try {
    const { userId, message, priority = 'medium' } = req.body;
    const adminId = req.user.id;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'User ID and message are required'
      });
    }

    // Get user details
    const [users] = await pool.query(
      'SELECT id, username, full_name, email FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Send notification
    await createNotification(
      userId,
      'user_activity',
      '💬 Message from Administrator',
      message,
      {
        data: {
          from: req.user.full_name || req.user.username,
          fromEmail: req.user.email,
          sentAt: new Date()
        },
        priority: priority,
        action_url: '/notifications',
        action_label: 'View Messages'
      }
    );

    // Log audit
    await logAudit(adminId, 'SEND_MESSAGE', 'user', userId, {
      recipient: user.username,
      message: message,
      priority: priority
    }, req);

    console.log(`✅ Admin ${req.user.username} sent message to user ${user.username}`);

    res.json({
      success: true,
      message: `Message sent successfully to ${user.full_name || user.username}`
    });

  } catch (error) {
    console.error('Send admin message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

/**
 * @route   GET /api/users/:id/recent-activity
 * @desc    Get user's recent activity (last 10 actions)
 * @access  Private (Admin)
 */
const getUserRecentActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    // Get recent activity from audit logs
    const [activities] = await pool.query(
      `SELECT
         action,
         resource_type,
         resource_id,
         details,
         ip_address,
         created_at
       FROM audit_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [id, parseInt(limit)]
    );

    // Format activities for display
    const formattedActivities = activities.map(activity => {
      let description = '';

      // Create human-readable descriptions
      switch (activity.action) {
        case 'CREATE':
          description = `Created ${activity.resource_type} ${activity.resource_id || ''}`;
          break;
        case 'UPDATE':
          description = `Updated ${activity.resource_type} ${activity.resource_id || ''}`;
          break;
        case 'DELETE':
          description = `Deleted ${activity.resource_type} ${activity.resource_id || ''}`;
          break;
        case 'VIEW':
          description = `Viewed ${activity.resource_type} ${activity.resource_id || ''}`;
          break;
        case 'LOGIN':
          description = `Logged in from ${activity.ip_address || 'unknown IP'}`;
          break;
        case 'LOGOUT':
          description = 'Logged out';
          break;
        default:
          description = `${activity.action} ${activity.resource_type || ''}`;
      }

      return {
        action: activity.action,
        description,
        resourceType: activity.resource_type,
        resourceId: activity.resource_id,
        timestamp: activity.created_at,
        ipAddress: activity.ip_address
      };
    });

    res.json({
      success: true,
      activities: formattedActivities,
      count: formattedActivities.length
    });

  } catch (error) {
    console.error('Get user recent activity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user activity'
    });
  }
};

module.exports = {
  getUserSessionStats,
  forceLogoutUser,
  sendAdminMessage,
  getUserRecentActivity
};
