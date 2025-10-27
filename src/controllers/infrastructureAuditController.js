const { pool } = require('../config/database');

/**
 * @route   GET /api/infrastructure/audit
 * @desc    Get infrastructure audit logs
 * @access  Private (Admin only)
 */
const getInfrastructureAuditLogs = async (req, res) => {
  try {
    const { limit = 50, offset = 0, action, userId, itemId } = req.query;

    let query = `
      SELECT ial.*, u.username, u.full_name, inf.item_name
      FROM infrastructure_audit_logs ial
      LEFT JOIN users u ON ial.user_id = u.id
      LEFT JOIN infrastructure inf ON ial.infrastructure_id = inf.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND ial.action = ?';
      params.push(action);
    }

    if (userId) {
      query += ' AND ial.user_id = ?';
      params.push(userId);
    }

    if (itemId) {
      query += ' AND ial.infrastructure_id = ?';
      params.push(itemId);
    }

    query += ' ORDER BY ial.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM infrastructure_audit_logs WHERE 1=1';
    const countParams = [];

    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }

    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }

    if (itemId) {
      countQuery += ' AND infrastructure_id = ?';
      countParams.push(itemId);
    }

    const [countResult] = await pool.query(countQuery, countParams);
    const total = countResult[0].total;

    res.json({ success: true, logs, count: logs.length, total });
  } catch (error) {
    console.error('Get infrastructure audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit logs' });
  }
};

/**
 * @route   GET /api/infrastructure/audit/:id
 * @desc    Get infrastructure audit log by ID
 * @access  Private (Admin only)
 */
const getInfrastructureAuditLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const [logs] = await pool.query(
      `SELECT ial.*, u.username, u.full_name, inf.item_name
       FROM infrastructure_audit_logs ial
       LEFT JOIN users u ON ial.user_id = u.id
       LEFT JOIN infrastructure inf ON ial.infrastructure_id = inf.id
       WHERE ial.id = ?`,
      [id]
    );

    if (logs.length === 0) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }

    res.json({ success: true, log: logs[0] });
  } catch (error) {
    console.error('Get infrastructure audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit log' });
  }
};

/**
 * @route   DELETE /api/infrastructure/audit/:id
 * @desc    Delete infrastructure audit log
 * @access  Private (Admin only)
 */
const deleteInfrastructureAuditLog = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM infrastructure_audit_logs WHERE id = ?', [id]);

    res.json({ success: true, message: 'Audit log deleted successfully' });
  } catch (error) {
    console.error('Delete infrastructure audit log error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete audit log' });
  }
};

/**
 * @route   DELETE /api/infrastructure/audit
 * @desc    Clear all infrastructure audit logs
 * @access  Private (Admin only)
 */
const clearInfrastructureAuditLogs = async (req, res) => {
  try {
    await pool.query('DELETE FROM infrastructure_audit_logs');

    res.json({ success: true, message: 'All infrastructure audit logs cleared successfully' });
  } catch (error) {
    console.error('Clear infrastructure audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to clear audit logs' });
  }
};

/**
 * @route   GET /api/infrastructure/audit/stats
 * @desc    Get infrastructure audit statistics
 * @access  Private (Admin only)
 */
const getInfrastructureAuditStats = async (req, res) => {
  try {
    // Get action counts
    const [actionCounts] = await pool.query(`
      SELECT action, COUNT(*) as count
      FROM infrastructure_audit_logs
      GROUP BY action
    `);

    // Get recent activity (last 7 days)
    const [recentActivity] = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM infrastructure_audit_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get top users
    const [topUsers] = await pool.query(`
      SELECT u.username, u.full_name, COUNT(*) as action_count
      FROM infrastructure_audit_logs ial
      LEFT JOIN users u ON ial.user_id = u.id
      GROUP BY ial.user_id, u.username, u.full_name
      ORDER BY action_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        actionCounts,
        recentActivity,
        topUsers
      }
    });
  } catch (error) {
    console.error('Get infrastructure audit stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit statistics' });
  }
};

/**
 * @route   GET /api/infrastructure/:id/audit
 * @desc    Get audit history for specific infrastructure item
 * @access  Private
 */
const getInfrastructureItemAuditHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const [logs] = await pool.query(
      `SELECT ial.*, u.username, u.full_name
       FROM infrastructure_audit_logs ial
       LEFT JOIN users u ON ial.user_id = u.id
       WHERE ial.infrastructure_id = ?
       ORDER BY ial.created_at DESC`,
      [id]
    );

    res.json({ success: true, logs, count: logs.length });
  } catch (error) {
    console.error('Get infrastructure item audit history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit history' });
  }
};

/**
 * @route   GET /api/infrastructure/audit/export
 * @desc    Export infrastructure audit logs
 * @access  Private (Admin only)
 */
const exportAuditLogs = async (req, res) => {
  try {
    const [logs] = await pool.query(`
      SELECT ial.*, u.username, u.full_name, inf.item_name
      FROM infrastructure_audit_logs ial
      LEFT JOIN users u ON ial.user_id = u.id
      LEFT JOIN infrastructure inf ON ial.infrastructure_id = inf.id
      ORDER BY ial.created_at DESC
    `);

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Export infrastructure audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to export audit logs' });
  }
};

/**
 * @route   GET /api/infrastructure/audit/actions
 * @desc    Get list of audit actions
 * @access  Private (Admin only)
 */
const getAuditActions = async (req, res) => {
  try {
    const [actions] = await pool.query(`
      SELECT DISTINCT action
      FROM infrastructure_audit_logs
      ORDER BY action ASC
    `);

    res.json({
      success: true,
      actions: actions.map(a => a.action)
    });
  } catch (error) {
    console.error('Get audit actions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit actions' });
  }
};

module.exports = {
  getInfrastructureAuditLogs,
  getInfrastructureAuditLogById,
  deleteInfrastructureAuditLog,
  clearInfrastructureAuditLogs,
  getInfrastructureAuditStats,
  getInfrastructureItemAuditHistory,
  exportAuditLogs,
  getAuditActions
};
