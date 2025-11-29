const { pool } = require('../config/database');
const { hashPassword } = require('../utils/bcrypt');
const { logAudit } = require('./auditController');
const { sendVerificationEmail } = require('../services/emailService');
const { createNotification, notifyAllAdmins } = require('./notificationController');
const { calculateTimeRemaining } = require('./userHelpers');

/**
 * @route   GET /api/users
 * @desc    Get all users (paginated)
 * @access  Private (Manager/Admin)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role } = req.query;
    const offset = (page - 1) * limit;

    // Build query - include new fields and email verification status
    let query = 'SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, is_email_verified, email_verified_at, mfa_enabled, mfa_method, mfa_enabled_at, created_at FROM users WHERE 1=1';
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
    const [countResult] = await pool.query(query.replace('SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, is_email_verified, email_verified_at, created_at', 'SELECT COUNT(*) as total'), params);
    const total = countResult[0].total;

    // Get paginated data
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [users] = await pool.query(query, params);

    // Fetch regions and temporary access for each user
    for (const user of users) {
      const [regions] = await pool.query(
        `SELECT r.name
         FROM regions r
         INNER JOIN user_regions ur ON r.id = ur.region_id
         WHERE ur.user_id = ? AND r.is_active = true`,
        [user.id]
      );
      user.assignedRegions = regions.map(r => r.name);

      // Debug logging for region assignments
      if (regions.length > 0) {
        console.log(`📍 User ${user.username} (ID: ${user.id}) has ${regions.length} regions assigned`);
      }

      // Fetch active temporary access with time remaining
      const [tempAccess] = await pool.query(
        `SELECT ta.id, r.name as region_name, ta.end_time,
                TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), ta.end_time) as seconds_remaining,
                u2.full_name as granted_by_name, ta.start_time, ta.reason
         FROM temporary_access_log ta
         INNER JOIN regions r ON ta.region_id = r.id
         LEFT JOIN users u2 ON ta.granted_by = u2.id
         WHERE ta.user_id = ?
           
           AND ta.status != 'revoked'
           AND ta.end_time > UTC_TIMESTAMP()
         ORDER BY ta.end_time ASC`,
        [user.id]
      );

      user.temporaryAccess = tempAccess.map(ta => ({
        id: ta.id,
        region: ta.region_name,
        expiresAt: ta.end_time,
        grantedAt: ta.start_time,
        grantedByName: ta.granted_by_name,
        reason: ta.reason,
        secondsRemaining: ta.seconds_remaining,
        timeRemaining: calculateTimeRemaining(ta.seconds_remaining)
      }));
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
    // Trim whitespace from all text inputs to prevent issues
    const username = req.body.username?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const full_name = req.body.full_name?.trim();
    const role = req.body.role;
    const phone = req.body.phone?.trim();
    const department = req.body.department?.trim();
    const office_location = req.body.office_location?.trim();
    const gender = req.body.gender;
    const street = req.body.street?.trim();
    const city = req.body.city?.trim();
    const state = req.body.state?.trim();
    const pincode = req.body.pincode?.trim();
    const assignedRegions = req.body.assignedRegions;

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

    // Create user with new fields (set both password and password_hash)
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password, password_hash, full_name, gender, role, phone, department, office_location, street, city, state, pincode, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, password_hash, password_hash, full_name, gender || 'Other', role || 'viewer', phone, department, office_location, street, city, state, pincode, createdBy]
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

    // Send verification email
    try {
      await sendVerificationEmail({
        id: userId,
        email,
        username,
        full_name,
        role: role || 'viewer',
        password // Send plain password before it was hashed
      });
      console.log(`✅ Verification email sent to ${email} (User created by admin)`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue even if email fails - user is still created
    }

    // Log audit
    await logAudit(createdBy, 'CREATE', 'user', userId, {
      username,
      email,
      full_name,
      role: role || 'viewer',
      assignedRegions: assignedRegions || []
    }, req);

    res.status(201).json({
      success: true,
      user: newUser[0],
      message: 'User created successfully. Verification email has been sent.'
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

    // Trim whitespace from all text inputs to prevent issues
    const username = req.body.username?.trim();
    const full_name = req.body.full_name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const gender = req.body.gender;
    const role = req.body.role;
    const phone = req.body.phone?.trim();
    const department = req.body.department?.trim();
    const office_location = req.body.office_location?.trim();
    const street = req.body.street?.trim();
    const city = req.body.city?.trim();
    const state = req.body.state?.trim();
    const pincode = req.body.pincode?.trim();
    const assignedRegions = req.body.assignedRegions;

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

    if (username) {
      // Check if username is already taken by another user
      const [existingUsers] = await pool.query(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, id]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ success: false, error: 'Username already in use' });
      }

      updates.push('username = ?');
      params.push(username);
    }
    if (full_name) {
      updates.push('full_name = ?');
      params.push(full_name);
    }
    if (email) {
      // Check if email is already taken by another user
      const [existingUsers] = await pool.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ success: false, error: 'Email already in use' });
      }

      updates.push('email = ?');
      params.push(email);
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

      // Get existing regions before update (for notification)
      const [existingRegions] = await pool.query(
        `SELECT r.name FROM regions r
         INNER JOIN user_regions ur ON r.id = ur.region_id
         WHERE ur.user_id = ?`,
        [id]
      );
      const oldRegionNames = existingRegions.map(r => r.name);

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

            // Insert into user_regions (use INSERT IGNORE to skip duplicates)
            const assignedBy = req.user ? req.user.id : null;
            await pool.query(
              `INSERT IGNORE INTO user_regions (user_id, region_id, access_level, assigned_by)
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

      // Notify user about region changes
      const addedRegions = assignedRegions.filter(r => !oldRegionNames.includes(r));
      const removedRegions = oldRegionNames.filter(r => !assignedRegions.includes(r));

      if (addedRegions.length > 0 || removedRegions.length > 0) {
        try {
          // Get user info for notification
          const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [id]);
          const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

          let notificationMessage = 'Your assigned regions have been updated by an administrator.\n\n';

          if (addedRegions.length > 0) {
            notificationMessage += `✅ Added: ${addedRegions.join(', ')}\n`;
          }
          if (removedRegions.length > 0) {
            notificationMessage += `❌ Removed: ${removedRegions.join(', ')}\n`;
          }

          notificationMessage += `\nCurrent regions: ${assignedRegions.length > 0 ? assignedRegions.join(', ') : 'None'}`;

          await createNotification(
            id,
            'region_request',
            '🗺️ Regions Updated',
            notificationMessage,
            {
              data: {
                addedRegions,
                removedRegions,
                currentRegions: assignedRegions,
                updatedBy: req.user?.full_name || req.user?.username
              },
              priority: 'medium',
              action_url: '/map',
              action_label: 'View Map'
            }
          );
          console.log(`📧 User ${userName} notified about region changes (Edit User)`);
        } catch (notifError) {
          console.error('Failed to send region update notification:', notifError);
        }
      }
    }

    // Fetch the updated user
    const [updatedUser] = await pool.query(
      `SELECT id, username, email, full_name, gender, role, phone, department, office_location, street, city, state, pincode, is_active, created_at
       FROM users WHERE id = ?`,
      [id]
    );

    // Log audit
    await logAudit(req.user.id, 'UPDATE', 'user', id, {
      updated_fields: { username, full_name, email, gender, role, phone, department, office_location, street, city, state, pincode },
      assignedRegions: assignedRegions || []
    }, req);

    // Notify all admins about user update
    try {
      const updatedByName = req.user?.full_name || req.user?.username || 'Administrator';
      const targetUserName = updatedUser[0]?.full_name || updatedUser[0]?.username || 'User';

      let changesDescription = [];
      if (username) changesDescription.push('username');
      if (full_name) changesDescription.push('name');
      if (email) changesDescription.push('email');
      if (role) changesDescription.push('role');
      if (assignedRegions) changesDescription.push('regions');

      await notifyAllAdmins(
        'user_activity',
        '👤 User Updated',
        `${updatedByName} updated ${targetUserName}'s profile. Changes: ${changesDescription.join(', ') || 'profile details'}`,
        {
          data: {
            userId: id,
            username: updatedUser[0]?.username,
            updatedBy: updatedByName,
            changes: changesDescription,
            newRegions: assignedRegions
          },
          priority: 'low',
          action_url: `/admin/users/${id}`,
          action_label: 'View User'
        }
      );
      console.log(`📧 Admins notified about user update: ${targetUserName}`);
    } catch (notifError) {
      console.error('Failed to notify admins about user update:', notifError);
    }

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

    // Get user details before deletion for audit log
    const [users] = await pool.query(
      'SELECT username, email, full_name, role FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const deletedUser = users[0];

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    // Log audit
    await logAudit(req.user.id, 'DELETE', 'user', id, {
      username: deletedUser.username,
      email: deletedUser.email,
      full_name: deletedUser.full_name,
      role: deletedUser.role
    }, req);

    // Notify all admins about user deletion
    try {
      const deletedByName = req.user?.full_name || req.user?.username || 'Administrator';
      const deletedUserName = deletedUser.full_name || deletedUser.username || 'User';

      await notifyAllAdmins(
        'user_activity',
        '🗑️ User Deleted',
        `${deletedByName} deleted user ${deletedUserName} (${deletedUser.email}) with role: ${deletedUser.role}`,
        {
          data: {
            userId: id,
            username: deletedUser.username,
            email: deletedUser.email,
            fullName: deletedUser.full_name,
            role: deletedUser.role,
            deletedBy: deletedByName
          },
          priority: 'high',
          action_url: '/admin/users',
          action_label: 'View Users'
        }
      );
      console.log(`📧 Admins notified about user deletion: ${deletedUserName}`);
    } catch (notifError) {
      console.error('Failed to notify admins about user deletion:', notifError);
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
