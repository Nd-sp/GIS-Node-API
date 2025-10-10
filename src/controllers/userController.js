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

    // Build query - include new fields
    let query = 'SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, created_at FROM users WHERE 1=1';
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
    const [countResult] = await pool.query(query.replace('SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, created_at', 'SELECT COUNT(*) as total'), params);
    const total = countResult[0].total;

    // Get paginated data
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);

    // Fetch regions for each user
    for (const user of users) {
      const [regions] = await pool.query(
        `SELECT r.name
         FROM regions r
         INNER JOIN user_regions ur ON r.id = ur.region_id
         WHERE ur.user_id = ? AND r.is_active = true`,
        [user.id]
      );
      user.assignedRegions = regions.map(r => r.name);
    }

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
      `SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, is_email_verified, last_login, created_at
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
    const {
      username, email, password, full_name, role, phone, department, office_location,
      gender, street, city, state, pincode, assignedRegions
    } = req.body;

    // DEBUG LOGGING
    console.log('=== CREATE USER DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Logged in user (req.user):', req.user);
    console.log('assignedRegions:', assignedRegions);
    console.log('========================');

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

    // Get created_by from logged-in user
    const createdBy = req.user ? req.user.id : null;
    console.log('Created by user ID:', createdBy);

    // Create user with new fields
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, gender, role, phone, department, office_location, street, city, state, pincode, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, password_hash, full_name, gender || 'Other', role || 'viewer', phone, department, office_location, street, city, state, pincode, createdBy]
    );

    const userId = result.insertId;

    // Assign regions if provided (accepts region names, will find or create)
    console.log(`Checking assignedRegions: ${JSON.stringify(assignedRegions)}`);
    console.log(`Is array? ${Array.isArray(assignedRegions)}, Length: ${assignedRegions?.length}`);

    if (assignedRegions && Array.isArray(assignedRegions) && assignedRegions.length > 0) {
      console.log(`✅ Processing ${assignedRegions.length} regions for user ${userId}`);
      for (const regionName of assignedRegions) {
        try {
          // Find region by name
          let [regions] = await pool.query(
            'SELECT id FROM regions WHERE name = ? AND is_active = true',
            [regionName]
          );

          let regionId;
          if (regions.length > 0) {
            // Region exists, use its ID
            regionId = regions[0].id;
          } else {
            // Region doesn't exist, create it with a unique code
            // Generate code: First 2 letters + last letter, all uppercase
            let regionCode = (regionName.substring(0, 2) + regionName.charAt(regionName.length - 1)).toUpperCase();

            // If code still conflicts, add a random number
            let codeAttempt = regionCode;
            let attempts = 0;
            while (attempts < 10) {
              try {
                const [newRegion] = await pool.query(
                  `INSERT INTO regions (name, code, type, is_active)
                   VALUES (?, ?, 'state', true)`,
                  [regionName, codeAttempt]
                );
                regionId = newRegion.insertId;
                console.log(`Created new region: ${regionName} with ID ${regionId} (code: ${codeAttempt})`);
                break;
              } catch (insertErr) {
                if (insertErr.code === 'ER_DUP_ENTRY') {
                  // Code conflict, try with a number suffix
                  attempts++;
                  codeAttempt = regionCode + attempts;
                  console.log(`Code conflict, retrying with: ${codeAttempt}`);
                } else {
                  throw insertErr;
                }
              }
            }

            if (!regionId) {
              throw new Error(`Failed to create region ${regionName} after multiple attempts`);
            }
          }

          // Insert into user_regions
          const assignedBy = req.user ? req.user.id : null;
          await pool.query(
            `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
             VALUES (?, ?, 'read', ?)`,
            [userId, regionId, assignedBy]
          );
          console.log(`Assigned region ${regionName} (ID: ${regionId}) to user ${userId}`);
        } catch (err) {
          console.error(`Error assigning region ${regionName}:`, err);
        }
      }
    } else {
      console.log(`⚠️  No regions assigned. Reason: ${!assignedRegions ? 'assignedRegions is null/undefined' : !Array.isArray(assignedRegions) ? 'Not an array' : 'Empty array'}`);
    }

    // Fetch the created user with all fields
    const [newUser] = await pool.query(
      `SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    res.status(201).json({
      success: true,
      user: newUser[0]
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
    const { full_name, gender, role, phone, department, office_location, street, city, state, pincode, assignedRegions } = req.body;

    console.log('=== UPDATE USER DEBUG ===');
    console.log('User ID:', id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('assignedRegions:', assignedRegions);
    console.log('========================');

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
    if (gender) {
      updates.push('gender = ?');
      params.push(gender);
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
    if (office_location !== undefined) {
      updates.push('office_location = ?');
      params.push(office_location);
    }
    if (street !== undefined) {
      updates.push('street = ?');
      params.push(street);
    }
    if (city !== undefined) {
      updates.push('city = ?');
      params.push(city);
    }
    if (state !== undefined) {
      updates.push('state = ?');
      params.push(state);
    }
    if (pincode !== undefined) {
      updates.push('pincode = ?');
      params.push(pincode);
    }

    if (updates.length === 0 && !assignedRegions) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    // Update user fields if any
    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(id);

      await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      console.log(`✅ Updated user ${id} basic fields`);
    }

    // Update assigned regions if provided
    if (assignedRegions && Array.isArray(assignedRegions)) {
      console.log(`🔄 Updating assigned regions for user ${id}...`);

      // First, remove all existing region assignments
      await pool.query('DELETE FROM user_regions WHERE user_id = ?', [id]);
      console.log(`Removed existing region assignments for user ${id}`);

      // Then, add new region assignments
      if (assignedRegions.length > 0) {
        for (const regionName of assignedRegions) {
          try {
            // Find region by name
            let [regions] = await pool.query(
              'SELECT id FROM regions WHERE name = ? AND is_active = true',
              [regionName]
            );

            let regionId;
            if (regions.length > 0) {
              regionId = regions[0].id;
            } else {
              // Region doesn't exist, create it
              let regionCode = (regionName.substring(0, 2) + regionName.charAt(regionName.length - 1)).toUpperCase();
              let codeAttempt = regionCode;
              let attempts = 0;

              while (attempts < 10) {
                try {
                  const [newRegion] = await pool.query(
                    `INSERT INTO regions (name, code, type, is_active)
                     VALUES (?, ?, 'state', true)`,
                    [regionName, codeAttempt]
                  );
                  regionId = newRegion.insertId;
                  console.log(`Created new region: ${regionName} with ID ${regionId} (code: ${codeAttempt})`);
                  break;
                } catch (insertErr) {
                  if (insertErr.code === 'ER_DUP_ENTRY') {
                    attempts++;
                    codeAttempt = regionCode + attempts;
                  } else {
                    throw insertErr;
                  }
                }
              }

              if (!regionId) {
                throw new Error(`Failed to create region ${regionName}`);
              }
            }

            // Insert into user_regions
            const assignedBy = req.user ? req.user.id : null;
            await pool.query(
              `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
               VALUES (?, ?, 'read', ?)`,
              [id, regionId, assignedBy]
            );
            console.log(`Assigned region ${regionName} (ID: ${regionId}) to user ${id}`);
          } catch (err) {
            console.error(`Error assigning region ${regionName}:`, err);
          }
        }
      }
      console.log(`✅ Updated regions for user ${id}`);
    }

    // Fetch the updated user
    const [updatedUser] = await pool.query(
      `SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, created_at
       FROM users WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser[0]
    });
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

/**
 * @route   DELETE /api/users/bulk-delete
 * @desc    Bulk delete users
 * @access  Private (Admin)
 */
const bulkDeleteUsers = async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'User IDs array required' });
    }

    // Don't allow deleting self
    if (user_ids.includes(req.user.id)) {
      return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    }

    // Delete users
    const placeholders = user_ids.map(() => '?').join(',');
    const [result] = await pool.query(
      `DELETE FROM users WHERE id IN (${placeholders})`,
      user_ids
    );

    res.json({
      success: true,
      count: result.affectedRows,
      message: `${result.affectedRows} user(s) deleted successfully`
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk delete users' });
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
  unassignRegion,
  bulkDeleteUsers
};
