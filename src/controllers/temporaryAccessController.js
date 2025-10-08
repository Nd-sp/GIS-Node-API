const { pool } = require('../config/database');

/**
 * @route   GET /api/temporary-access
 * @desc    Get all temporary access grants (admin/manager)
 * @access  Private (Admin/Manager)
 */
const getAllTemporaryAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can view temporary access'
      });
    }

    const { status, user_id } = req.query;

    let query = `
      SELECT ta.*,
             u.username,
             u.full_name,
             u.email,
             r.name as region_name,
             r.code as region_code,
             granter.username as granted_by_username
      FROM temporary_access ta
      INNER JOIN users u ON ta.user_id = u.id
      INNER JOIN regions r ON ta.region_id = r.id
      INNER JOIN users granter ON ta.granted_by = granter.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND ta.status = ?';
      params.push(status);
    }

    if (user_id) {
      query += ' AND ta.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY ta.created_at DESC';

    const [access] = await pool.query(query, params);

    res.json({ success: true, access });
  } catch (error) {
    console.error('Get temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to get temporary access' });
  }
};

/**
 * @route   POST /api/temporary-access
 * @desc    Grant temporary access to region (manager+)
 * @access  Private (Manager/Admin)
 */
const grantTemporaryAccess = async (req, res) => {
  try {
    const granterId = req.user.id;
    const granterRole = req.user.role;

    if (granterRole !== 'admin' && granterRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can grant temporary access'
      });
    }

    const { user_id, region_id, access_level, valid_from, valid_until, reason } = req.body;

    if (!user_id || !region_id || !valid_until) {
      return res.status(400).json({
        success: false,
        error: 'User ID, region ID, and valid_until are required'
      });
    }

    // Verify user exists
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify region exists
    const [regions] = await pool.query('SELECT id FROM regions WHERE id = ?', [region_id]);
    if (regions.length === 0) {
      return res.status(404).json({ success: false, error: 'Region not found' });
    }

    // Check if user already has permanent access
    const [existingAccess] = await pool.query(
      'SELECT id FROM user_regions WHERE user_id = ? AND region_id = ?',
      [user_id, region_id]
    );

    if (existingAccess.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has permanent access to this region'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO temporary_access
       (user_id, region_id, access_level, valid_from, valid_until, reason, granted_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        user_id,
        region_id,
        access_level || 'read',
        valid_from || new Date(),
        valid_until,
        reason,
        granterId
      ]
    );

    res.status(201).json({
      success: true,
      access: {
        id: result.insertId,
        user_id,
        region_id,
        access_level: access_level || 'read',
        valid_until
      }
    });
  } catch (error) {
    console.error('Grant temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to grant temporary access' });
  }
};

/**
 * @route   DELETE /api/temporary-access/:id
 * @desc    Revoke temporary access (manager+)
 * @access  Private (Manager/Admin)
 */
const revokeTemporaryAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can revoke temporary access'
      });
    }

    // Check if access exists
    const [access] = await pool.query(
      'SELECT id, status FROM temporary_access WHERE id = ?',
      [id]
    );

    if (access.length === 0) {
      return res.status(404).json({ success: false, error: 'Temporary access not found' });
    }

    if (access[0].status === 'revoked') {
      return res.status(400).json({
        success: false,
        error: 'Access already revoked'
      });
    }

    await pool.query(
      'UPDATE temporary_access SET status = ?, revoked_at = NOW() WHERE id = ?',
      ['revoked', id]
    );

    res.json({ success: true, message: 'Temporary access revoked successfully' });
  } catch (error) {
    console.error('Revoke temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to revoke temporary access' });
  }
};

module.exports = {
  getAllTemporaryAccess,
  grantTemporaryAccess,
  revokeTemporaryAccess
};
