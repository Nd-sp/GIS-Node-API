const { pool } = require('../config/database');

/**
 * @route   GET /api/groups
 * @desc    Get all user's groups
 * @access  Private
 */
const getAllGroups = async (req, res) => {
  try {
    const userId = req.user.id;

    const [groups] = await pool.query(
      `SELECT g.*,
              COUNT(DISTINCT gm.id) as member_count,
              gm2.role as user_role
       FROM \`groups\` g
       LEFT JOIN group_members gm ON g.id = gm.group_id
       INNER JOIN group_members gm2 ON g.id = gm2.group_id AND gm2.user_id = ?
       GROUP BY g.id, gm2.role
       ORDER BY g.created_at DESC`,
      [userId]
    );

    res.json({ success: true, groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ success: false, error: 'Failed to get groups' });
  }
};

/**
 * @route   GET /api/groups/:id
 * @desc    Get group by ID
 * @access  Private
 */
const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is a member of this group
    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member of this group' });
    }

    const [groups] = await pool.query(
      `SELECT g.*,
              u.username as owner_username,
              u.full_name as owner_name
       FROM \`groups\` g
       INNER JOIN users u ON g.owner_id = u.id
       WHERE g.id = ?`,
      [id]
    );

    if (groups.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const group = groups[0];
    group.user_role = membership[0].role;

    res.json({ success: true, group });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ success: false, error: 'Failed to get group' });
  }
};

/**
 * @route   POST /api/groups
 * @desc    Create new group
 * @access  Private
 */
const createGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, is_public } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Group name required' });
    }

    // Create group
    const [result] = await pool.query(
      `INSERT INTO \`groups\` (name, description, owner_id, is_public)
       VALUES (?, ?, ?, ?)`,
      [name, description, userId, is_public || false]
    );

    const groupId = result.insertId;

    // Add creator as owner member
    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role, added_by)
       VALUES (?, ?, 'owner', ?)`,
      [groupId, userId, userId]
    );

    res.status(201).json({
      success: true,
      group: {
        id: groupId,
        name,
        description,
        owner_id: userId
      }
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
};

/**
 * @route   PUT /api/groups/:id
 * @desc    Update group
 * @access  Private (Owner only)
 */
const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, is_public } = req.body;

    // Check if user is owner
    const [groups] = await pool.query(
      'SELECT owner_id FROM `groups` WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    if (groups[0].owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only owner can update group' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      params.push(is_public);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.query(
      `UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Group updated successfully' });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
};

/**
 * @route   DELETE /api/groups/:id
 * @desc    Delete group
 * @access  Private (Owner only)
 */
const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is owner
    const [groups] = await pool.query(
      'SELECT owner_id FROM `groups` WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    if (groups[0].owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only owner can delete group' });
    }

    await pool.query('DELETE FROM `groups` WHERE id = ?', [id]);

    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
};

/**
 * @route   GET /api/groups/:id/members
 * @desc    Get group members
 * @access  Private
 */
const getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if user is a member
    const [membership] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ success: false, error: 'Not a member of this group' });
    }

    const [members] = await pool.query(
      `SELECT gm.*,
              u.username,
              u.full_name,
              u.email,
              u.role as user_role,
              adder.username as added_by_username
       FROM group_members gm
       INNER JOIN users u ON gm.user_id = u.id
       LEFT JOIN users adder ON gm.added_by = adder.id
       WHERE gm.group_id = ?
       ORDER BY
         CASE gm.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'member' THEN 3
         END,
         gm.joined_at ASC`,
      [id]
    );

    res.json({ success: true, members });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ success: false, error: 'Failed to get group members' });
  }
};

/**
 * @route   POST /api/groups/:id/members
 * @desc    Add member to group
 * @access  Private (Owner/Admin)
 */
const addGroupMember = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { user_id, role = 'member' } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, error: 'User ID required' });
    }

    // Check if requester is owner or admin
    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    if (membership.length === 0 || (membership[0].role !== 'owner' && membership[0].role !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Only owner or admin can add members' });
    }

    // Check if user already member
    const [existing] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, user_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'User already a member' });
    }

    // Verify user exists
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await pool.query(
      `INSERT INTO group_members (group_id, user_id, role, added_by)
       VALUES (?, ?, ?, ?)`,
      [id, user_id, role, userId]
    );

    res.status(201).json({ success: true, message: 'Member added successfully' });
  } catch (error) {
    console.error('Add group member error:', error);
    res.status(500).json({ success: false, error: 'Failed to add member' });
  }
};

/**
 * @route   DELETE /api/groups/:id/members/:userId
 * @desc    Remove member from group
 * @access  Private (Owner/Admin)
 */
const removeGroupMember = async (req, res) => {
  try {
    const { id, userId: memberUserId } = req.params;
    const userId = req.user.id;

    // Check if requester is owner or admin
    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    if (membership.length === 0 || (membership[0].role !== 'owner' && membership[0].role !== 'admin')) {
      return res.status(403).json({ success: false, error: 'Only owner or admin can remove members' });
    }

    // Check member to remove
    const [memberToRemove] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, memberUserId]
    );

    if (memberToRemove.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found in group' });
    }

    // Cannot remove owner
    if (memberToRemove[0].role === 'owner') {
      return res.status(400).json({ success: false, error: 'Cannot remove group owner' });
    }

    await pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, memberUserId]
    );

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove group member error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
};

/**
 * @route   PATCH /api/groups/:id/members/:userId/role
 * @desc    Update member role
 * @access  Private (Owner only)
 */
const updateMemberRole = async (req, res) => {
  try {
    const { id, userId: memberUserId } = req.params;
    const userId = req.user.id;
    const { role } = req.body;

    if (!role || !['member', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be member or admin' });
    }

    // Check if requester is owner
    const [groups] = await pool.query(
      'SELECT owner_id FROM `groups` WHERE id = ?',
      [id]
    );

    if (groups.length === 0) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    if (groups[0].owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Only owner can update member roles' });
    }

    // Check if member exists
    const [members] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, memberUserId]
    );

    if (members.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found in group' });
    }

    await pool.query(
      'UPDATE group_members SET role = ?, updated_at = NOW() WHERE group_id = ? AND user_id = ?',
      [role, id, memberUserId]
    );

    res.json({ success: true, message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ success: false, error: 'Failed to update member role' });
  }
};

module.exports = {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateMemberRole
};
