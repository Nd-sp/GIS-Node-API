const { pool } = require('../config/database');

/**
 * @route   GET /api/permissions
 * @desc    Get all permissions (admin only)
 * @access  Private (Admin)
 */
const getAllPermissions = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can view all permissions'
      });
    }

    const { role, resource } = req.query;

    let query = 'SELECT * FROM permissions WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (resource) {
      query += ' AND resource = ?';
      params.push(resource);
    }

    query += ' ORDER BY role, resource';

    const [permissions] = await pool.query(query, params);

    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get permissions' });
  }
};

/**
 * @route   GET /api/permissions/:id
 * @desc    Get permission by ID (admin only)
 * @access  Private (Admin)
 */
const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can view permissions'
      });
    }

    const [permissions] = await pool.query(
      'SELECT * FROM permissions WHERE id = ?',
      [id]
    );

    if (permissions.length === 0) {
      return res.status(404).json({ success: false, error: 'Permission not found' });
    }

    res.json({ success: true, permission: permissions[0] });
  } catch (error) {
    console.error('Get permission error:', error);
    res.status(500).json({ success: false, error: 'Failed to get permission' });
  }
};

/**
 * @route   POST /api/permissions
 * @desc    Create new permission (admin only)
 * @access  Private (Admin)
 */
const createPermission = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can create permissions'
      });
    }

    const { role, resource, actions, description } = req.body;

    if (!role || !resource || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        error: 'Role, resource, and actions array are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be one of: admin, manager, editor, viewer'
      });
    }

    // Validate actions
    const validActions = ['create', 'read', 'update', 'delete', 'manage'];
    const invalidActions = actions.filter(action => !validActions.includes(action));
    if (invalidActions.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid actions: ${invalidActions.join(', ')}`
      });
    }

    // Check if permission already exists
    const [existing] = await pool.query(
      'SELECT id FROM permissions WHERE role = ? AND resource = ?',
      [role, resource]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Permission for this role and resource already exists'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO permissions (role, resource, actions, description)
       VALUES (?, ?, ?, ?)`,
      [role, resource, JSON.stringify(actions), description]
    );

    res.status(201).json({
      success: true,
      permission: {
        id: result.insertId,
        role,
        resource,
        actions
      }
    });
  } catch (error) {
    console.error('Create permission error:', error);
    res.status(500).json({ success: false, error: 'Failed to create permission' });
  }
};

module.exports = {
  getAllPermissions,
  getPermissionById,
  createPermission
};
