const { pool } = require('../config/database');

/**
 * Group Permission Controller
 * Handles group-level permission management and region assignments
 */

/**
 * @route   GET /api/groups/:groupId/permissions
 * @desc    Get permissions assigned to a group
 * @access  Private (Group members)
 */
const getGroupPermissions = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Check if user is a member or admin
    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    const isAdmin = req.user.role === 'admin';

    if (membership.length === 0 && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view group permissions'
      });
    }

    // Get group permissions
    const [permissions] = await pool.query(
      `SELECT gp.*, u.username as granted_by_username
       FROM group_permissions gp
       LEFT JOIN users u ON gp.granted_by = u.id
       WHERE gp.group_id = ?
       ORDER BY gp.granted_at DESC`,
      [groupId]
    );

    res.json({
      success: true,
      permissions: permissions.map(p => p.permission_id),
      details: permissions
    });
  } catch (error) {
    console.error('Get group permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get group permissions'
    });
  }
};

/**
 * @route   PUT /api/groups/:groupId/permissions
 * @desc    Update group permissions
 * @access  Private (Group owner/admin or system admin)
 */
const updateGroupPermissions = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { permissions } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user is group owner/admin or system admin
    const [group] = await pool.query(
      'SELECT created_by FROM `groups` WHERE id = ?',
      [groupId]
    );

    if (group.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    const isGroupOwner = group[0].created_by === userId;
    const isGroupAdmin = membership.length > 0 && membership[0].role === 'admin';
    const isSystemAdmin = userRole === 'admin';

    if (!isGroupOwner && !isGroupAdmin && !isSystemAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only group owner/admin can update permissions'
      });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions must be an array'
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete existing permissions
      await connection.query(
        'DELETE FROM group_permissions WHERE group_id = ?',
        [groupId]
      );

      // Insert new permissions
      if (permissions.length > 0) {
        const values = permissions.map(permId => [groupId, permId, userId]);
        await connection.query(
          'INSERT INTO group_permissions (group_id, permission_id, granted_by) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `Updated ${permissions.length} permission(s) for group`
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Update group permissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update group permissions'
    });
  }
};

/**
 * @route   GET /api/groups/:groupId/regions
 * @desc    Get regions assigned to group
 * @access  Private (Group members)
 */
const getGroupRegions = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Check membership or admin
    const [membership] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    if (membership.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view group regions'
      });
    }

    // Get group regions
    const [regions] = await pool.query(
      `SELECT gr.*, r.name, r.code, r.type,
              u.username as assigned_by_username
       FROM group_regions gr
       INNER JOIN regions r ON gr.region_id = r.id
       LEFT JOIN users u ON gr.assigned_by = u.id
       WHERE gr.group_id = ?
       ORDER BY r.name`,
      [groupId]
    );

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Get group regions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get group regions'
    });
  }
};

/**
 * @route   PUT /api/groups/:groupId/regions
 * @desc    Update group region assignments
 * @access  Private (Group owner/admin or system admin)
 */
const updateGroupRegions = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { regionIds } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check authorization
    const [group] = await pool.query(
      'SELECT created_by FROM `groups` WHERE id = ?',
      [groupId]
    );

    if (group.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    const isAuthorized =
      group[0].created_by === userId ||
      (membership.length > 0 && membership[0].role === 'admin') ||
      userRole === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update group regions'
      });
    }

    if (!Array.isArray(regionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Region IDs must be an array'
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete existing region assignments
      await connection.query(
        'DELETE FROM group_regions WHERE group_id = ?',
        [groupId]
      );

      // Insert new region assignments
      if (regionIds.length > 0) {
        const values = regionIds.map(regionId => [groupId, regionId, userId]);
        await connection.query(
          'INSERT INTO group_regions (group_id, region_id, assigned_by) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `Updated ${regionIds.length} region(s) for group`
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Update group regions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update group regions'
    });
  }
};

module.exports = {
  getGroupPermissions,
  updateGroupPermissions,
  getGroupRegions,
  updateGroupRegions
};
