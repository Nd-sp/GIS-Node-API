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
      INNER JOIN regions r ON ta.resource_id = r.id
      INNER JOIN users granter ON ta.granted_by = granter.id
      WHERE ta.resource_type = 'region'
    `;
    const params = [];

    if (status) {
      if (status === 'active') {
        query += ' AND ta.revoked_at IS NULL AND ta.expires_at > NOW()';
      } else if (status === 'revoked') {
        query += ' AND ta.revoked_at IS NOT NULL';
      } else if (status === 'expired') {
        query += ' AND ta.revoked_at IS NULL AND ta.expires_at <= NOW()';
      }
    }

    if (user_id) {
      query += ' AND ta.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY ta.granted_at DESC';

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

    const { user_id, region_name, access_level, expires_at, reason } = req.body;

    if (!user_id || !region_name || !expires_at) {
      return res.status(400).json({
        success: false,
        error: 'User ID, region name, and expires_at are required'
      });
    }

    // Verify user exists
    const [users] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Find region by name
    const [regions] = await pool.query('SELECT id FROM regions WHERE name = ? AND is_active = true', [region_name]);
    if (regions.length === 0) {
      return res.status(404).json({ success: false, error: 'Region not found' });
    }

    const regionId = regions[0].id;

    // Check if user already has permanent access
    const [existingAccess] = await pool.query(
      'SELECT id FROM user_regions WHERE user_id = ? AND region_id = ?',
      [user_id, regionId]
    );

    if (existingAccess.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has permanent access to this region'
      });
    }

    // Check if active temporary access already exists
    const [existingTemp] = await pool.query(
      `SELECT id FROM temporary_access
       WHERE user_id = ? AND resource_type = 'region' AND resource_id = ?
       AND revoked_at IS NULL AND expires_at > NOW()`,
      [user_id, regionId]
    );

    if (existingTemp.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has active temporary access to this region'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO temporary_access
       (user_id, resource_type, resource_id, access_level, reason, granted_by, expires_at)
       VALUES (?, 'region', ?, ?, ?, ?, ?)`,
      [
        user_id,
        regionId,
        access_level || 'read',
        reason,
        granterId,
        expires_at
      ]
    );

    res.status(201).json({
      success: true,
      grant: {
        id: result.insertId,
        user_id,
        user_name: users[0].full_name,
        user_email: users[0].email,
        region_name,
        resource_id: regionId,
        access_level: access_level || 'read',
        granted_at: new Date(),
        expires_at,
        reason,
        granted_by: granterId,
        status: 'active'
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
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can revoke temporary access'
      });
    }

    // Check if access exists
    const [access] = await pool.query(
      'SELECT id, revoked_at FROM temporary_access WHERE id = ?',
      [id]
    );

    if (access.length === 0) {
      return res.status(404).json({ success: false, error: 'Temporary access not found' });
    }

    if (access[0].revoked_at !== null) {
      return res.status(400).json({
        success: false,
        error: 'Access already revoked'
      });
    }

    await pool.query(
      'UPDATE temporary_access SET revoked_at = NOW(), revoked_by = ? WHERE id = ?',
      [userId, id]
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
