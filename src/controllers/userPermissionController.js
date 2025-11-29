const { pool } = require('../config/database');

/**
 * User Permission Controller
 * Handles individual user permission management
 * Admin/Manager can assign permissions directly to users
 */

/**
 * @route   GET /api/users/:userId/permissions
 * @desc    Get user's effective permissions (direct + from groups)
 * @access  Private
 */
const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Only allow viewing own permissions or admin/manager can view others
    if (userId !== requesterId.toString() &&
        requesterRole !== 'admin' &&
        requesterRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view these permissions'
      });
    }

    // Get direct permissions
    const [directPerms] = await pool.query(
      'SELECT permission_id, granted_at, granted_by FROM user_permissions WHERE created_by = ?',
      [userId]
    );

    // Get permissions from groups
    const [groupPerms] = await pool.query(
      `SELECT DISTINCT gp.permission_id, g.name as group_name, gp.granted_at
       FROM group_permissions gp
       INNER JOIN group_members gm ON gp.group_id = gm.group_id
       INNER JOIN \`groups\` g ON gp.group_id = g.id
       WHERE gm.user_id = ? AND g.is_active = TRUE`,
      [userId]
    );

    // Check if user is admin (has all permissions)
    const [user] = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );

    const isAdmin = user[0]?.role === 'admin';

    res.json({
      success: true,
      permissions: {
        direct: directPerms.map(p => p.permission_id),
        directDetails: directPerms,
        fromGroups: groupPerms.map(p => p.permission_id),
        groupDetails: groupPerms,
        isAdmin
      }
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user permissions'
    });
  }
};

/**
 * @route   PUT /api/users/:userId/permissions
 * @desc    Update user's direct permissions
 * @access  Private (Admin/Manager only)
 */
const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    const grantedBy = req.user.id;
    const requesterRole = req.user.role;

    // Only admin or manager can update permissions
    if (requesterRole !== 'admin' && requesterRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can update permissions'
      });
    }

    // Validate permissions array
    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions must be an array'
      });
    }

    // Verify user exists
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete existing direct permissions
      await connection.query(
        'DELETE FROM user_permissions WHERE created_by = ?',
        [userId]
      );

      // Insert new permissions
      if (permissions.length > 0) {
        const values = permissions.map(permId => [userId, permId, grantedBy]);
        await connection.query(
          'INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `Updated ${permissions.length} permission(s) for user`
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user permissions'
    });
  }
};

/**
 * @route   POST /api/users/:userId/permissions/add
 * @desc    Add specific permissions to user
 * @access  Private (Admin/Manager only)
 */
const addUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    const grantedBy = req.user.id;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin' && requesterRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can add permissions'
      });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least one permission to add'
      });
    }

    // Insert permissions (ignore duplicates)
    const values = permissions.map(permId => [userId, permId, grantedBy]);

    await pool.query(
      `INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by)
       VALUES ?`,
      [values]
    );

    res.json({
      success: true,
      message: `Added ${permissions.length} permission(s)`
    });
  } catch (error) {
    console.error('Add user permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add permissions'
    });
  }
};

/**
 * @route   DELETE /api/users/:userId/permissions/remove
 * @desc    Remove specific permissions from user
 * @access  Private (Admin/Manager only)
 */
const removeUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    const requesterRole = req.user.role;

    if (requesterRole !== 'admin' && requesterRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can remove permissions'
      });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Provide at least one permission to remove'
      });
    }

    await pool.query(
      'DELETE FROM user_permissions WHERE created_by = ? AND permission_id IN (?)',
      [userId, permissions]
    );

    res.json({
      success: true,
      message: `Removed ${permissions.length} permission(s)`
    });
  } catch (error) {
    console.error('Remove user permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove permissions'
    });
  }
};

module.exports = {
  getUserPermissions,
  updateUserPermissions,
  addUserPermissions,
  removeUserPermissions
};
