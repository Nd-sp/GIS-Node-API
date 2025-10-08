const { pool } = require('../config/database');
const { hashPassword } = require('../utils/bcrypt');

/**
 * @route   GET /api/users
 * @desc    Get all users (paginated)
 * @access  Private (Manager/Admin)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role } = req.query;
    const offset = (page - 1) * limit;

    // Build query
    let query = 'SELECT id, username, email, full_name, role, phone, department, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    // Search filter
    if (search) {
      query += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Role filter
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    // Get total count
    const [countResult] = await pool.query(query.replace('SELECT id, username, email, full_name, role, phone, department, is_active, created_at', 'SELECT COUNT(*) as total'), params);
    const total = countResult[0].total;

    // Get paginated data
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
};

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.query(
      `SELECT id, username, email, full_name, role, phone, department, is_active, is_email_verified, last_login, created_at
       FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get user's regions
    const [regions] = await pool.query(
      `SELECT r.id, r.name, r.code, r.type, ur.access_level
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ?`,
      [id]
    );

    const user = users[0];
    user.regions = regions;

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
};

/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Private (Admin)
 */
const createUser = async (req, res) => {
  try {
    const { username, email, password, full_name, role, phone, department } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Check if user exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone, department, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, password_hash, full_name, role || 'viewer', phone, department, req.user.id]
    );

    res.status(201).json({
      success: true,
      user: {
        id: result.insertId,
        username,
        email,
        full_name,
        role: role || 'viewer'
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin or Own Profile)
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role, phone, department } = req.body;

    // Check if user can update (admin or own profile)
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const updates = [];
    const params = [];

    if (full_name) {
      updates.push('full_name = ?');
      params.push(full_name);
    }
    if (role && req.user.role === 'admin') {
      updates.push('role = ?');
      params.push(role);
    }
    if (phone) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (department) {
      updates.push('department = ?');
      params.push(department);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin)
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting self
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

/**
 * @route   PATCH /api/users/:id/activate
 * @desc    Activate user
 * @access  Private (Admin)
 */
const activateUser = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('UPDATE users SET is_active = true WHERE id = ?', [id]);

    res.json({ success: true, message: 'User activated successfully' });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({ success: false, error: 'Failed to activate user' });
  }
};

/**
 * @route   PATCH /api/users/:id/deactivate
 * @desc    Deactivate user
 * @access  Private (Admin)
 */
const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deactivating self
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    }

    await pool.query('UPDATE users SET is_active = false WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate user' });
  }
};

/**
 * @route   GET /api/users/:id/regions
 * @desc    Get user's regions
 * @access  Private
 */
const getUserRegions = async (req, res) => {
  try {
    const { id } = req.params;

    const [regions] = await pool.query(
      `SELECT r.*, ur.access_level, ur.assigned_at
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true`,
      [id]
    );

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Get user regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user regions' });
  }
};

/**
 * @route   POST /api/users/:id/regions
 * @desc    Assign region to user
 * @access  Private (Admin)
 */
const assignRegion = async (req, res) => {
  try {
    const { id } = req.params;
    const { regionId, accessLevel = 'read' } = req.body;

    if (!regionId) {
      return res.status(400).json({ success: false, error: 'Region ID required' });
    }

    await pool.query(
      `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_level = ?, assigned_by = ?`,
      [id, regionId, accessLevel, req.user.id, accessLevel, req.user.id]
    );

    res.json({ success: true, message: 'Region assigned successfully' });
  } catch (error) {
    console.error('Assign region error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign region' });
  }
};

/**
 * @route   DELETE /api/users/:id/regions/:regionId
 * @desc    Unassign region from user
 * @access  Private (Admin)
 */
const unassignRegion = async (req, res) => {
  try {
    const { id, regionId } = req.params;

    await pool.query(
      'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
      [id, regionId]
    );

    res.json({ success: true, message: 'Region unassigned successfully' });
  } catch (error) {
    console.error('Unassign region error:', error);
    res.status(500).json({ success: false, error: 'Failed to unassign region' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  getUserRegions,
  assignRegion,
  unassignRegion
};
