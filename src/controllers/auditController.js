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

    let query = `
      SELECT al.*,
             u.username,
             u.full_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Admin can see all logs, others see only their own
    if (userRole === 'admin') {
      if (user_id) {
        query += ' AND al.user_id = ?';
        params.push(user_id);
      }
    } else {
      query += ' AND al.user_id = ?';
      params.push(userId);
    }

    if (action_type) {
      query += ' AND al.action = ?';
      params.push(action_type);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
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

/**
 * @route   POST /api/audit/logs
 * @desc    Create audit log entry
 * @access  Private (System/Admin)
 */
const createAuditLog = async (req, res) => {
  try {
    const { action, resource_type, resource_id, details, ip_address, user_agent } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: 'Action is required'
      });
    }

    // Parse resource_id - if it's not a number, store it in details and set resource_id to null
    let finalResourceId = null;
    let finalDetails = details || {};
    
    if (resource_id !== null && resource_id !== undefined) {
      const resourceIdNum = parseInt(resource_id);
      if (!isNaN(resourceIdNum) && resourceIdNum.toString() === resource_id.toString()) {
        // It's a valid integer
        finalResourceId = resourceIdNum;
      } else {
        // It's a string (like region name), store in details
        finalDetails = {
          ...finalDetails,
          resource_name: resource_id
        };
      }
    }

    const [result] = await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        resource_type || null,
        finalResourceId,
        Object.keys(finalDetails).length > 0 ? JSON.stringify(finalDetails) : null,
        ip_address || req.ip,
        user_agent || req.get('User-Agent')
      ]
    );

    res.status(201).json({
      success: true,
      log: {
        id: result.insertId,
        user_id: userId,
        action,
        resource_type,
        resource_id,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('Create audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to create audit log' });
  }
};

/**
 * @route   DELETE /api/audit/logs/:id
 * @desc    Delete audit log (Admin only)
 * @access  Private (Admin)
 */
const deleteAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can delete audit logs'
      });
    }

    const [result] = await pool.query('DELETE FROM audit_logs WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }

    res.json({ success: true, message: 'Audit log deleted successfully' });
  } catch (error) {
    console.error('Delete audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete audit log' });
  }
};

/**
 * @route   DELETE /api/audit/logs
 * @desc    Clear all audit logs (Admin only)
 * @access  Private (Admin)
 */
const clearAllAuditLogs = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can clear audit logs'
      });
    }

    const [result] = await pool.query('DELETE FROM audit_logs');

    res.json({
      success: true,
      message: `Cleared ${result.affectedRows} audit log(s) successfully`,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Clear audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear audit logs' });
  }
};

/**
 * Helper function to log audit events (can be called from other controllers)
 */
const logAudit = async (userId, action, resourceType, resourceId, details, req) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        resourceType || null,
        resourceId || null,
        details ? JSON.stringify(details) : null,
        req?.ip || null,
        req?.get('User-Agent') || null
      ]
    );
  } catch (error) {
    console.error('Log audit error:', error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogById,
  getUserActivity,
  createAuditLog,
  deleteAuditLog,
  clearAllAuditLogs,
  logAudit
};
