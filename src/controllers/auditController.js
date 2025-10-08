const { pool } = require('../config/database');

/**
 * @route   GET /api/audit/logs
 * @desc    Get audit logs (Admin or own logs)
 * @access  Private
 */
const getAuditLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { limit = 50, offset = 0, action_type, user_id } = req.query;

    let query = 'SELECT * FROM audit_logs WHERE ';
    const params = [];

    // Admin can see all logs, others see only their own
    if (userRole === 'admin') {
      if (user_id) {
        query += 'user_id = ?';
        params.push(user_id);
      } else {
        query += '1=1'; // All logs
      }
    } else {
      query += 'user_id = ?';
      params.push(userId);
    }

    if (action_type) {
      query += ' AND action_type = ?';
      params.push(action_type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.query(query, params);

    res.json({ success: true, logs, count: logs.length });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit logs' });
  }
};

/**
 * @route   GET /api/audit/logs/:id
 * @desc    Get audit log by ID
 * @access  Private
 */
const getAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = 'SELECT * FROM audit_logs WHERE id = ?';
    const params = [id];

    // Non-admin can only see their own logs
    if (userRole !== 'admin') {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    const [logs] = await pool.query(query, params);

    if (logs.length === 0) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }

    res.json({ success: true, log: logs[0] });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit log' });
  }
};

/**
 * @route   GET /api/audit/user/:userId
 * @desc    Get user activity logs
 * @access  Private (Admin or own activity)
 */
const getUserActivity = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;
    const { limit = 50, days = 7 } = req.query;

    // Check authorization
    if (userRole !== 'admin' && currentUserId.toString() !== targetUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Can only view own activity logs'
      });
    }

    const [logs] = await pool.query(
      `SELECT action_type, resource_type, resource_id, created_at
       FROM audit_logs
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY created_at DESC
       LIMIT ?`,
      [targetUserId, parseInt(days), parseInt(limit)]
    );

    res.json({ success: true, activity: logs, count: logs.length });
  } catch (error) {
    console.error('Get user activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user activity' });
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById,
  getUserActivity
};
