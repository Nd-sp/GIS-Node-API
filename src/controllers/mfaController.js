const { pool } = require('../config/database');
const { comparePassword } = require('../utils/bcrypt');
const { send2FACode } = require('../services/emailService');
const { generateToken, generateRefreshToken } = require('../utils/jwt');
const crypto = require('crypto');

/**
 * Generate a random 6-digit code
 */
const generate2FACode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @route   POST /api/mfa/enable
 * @desc    Enable 2FA for user (requires password confirmation)
 * @access  Private
 */
const enable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password confirmation is required'
      });
    }

    // Get user from database
    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Check if 2FA is already enabled
    if (user.mfa_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is already enabled for your account'
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Generate test 2FA code
    const testCode = generate2FACode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store test code in database
    await pool.query(
      `INSERT INTO mfa_tokens (user_id, token, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, testCode, expiresAt, req.ip]
    );

    // Send test code via email
    try {
      await send2FACode(user.email, user.full_name, testCode);
    } catch (emailError) {
      console.error('Failed to send 2FA test code:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification code. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'Test verification code sent to your email',
      email: user.email,
      requireVerification: true
    });

  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable 2FA. Please try again.'
    });
  }
};

/**
 * @route   POST /api/mfa/verify-and-enable
 * @desc    Verify test code and fully enable 2FA
 * @access  Private
 */
const verifyAndEnable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code format'
      });
    }

    // Find valid token
    const [tokens] = await pool.query(
      `SELECT * FROM mfa_tokens
       WHERE created_by = ? AND token = ? AND is_used = FALSE AND end_time > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (tokens.length === 0) {
      // Increment attempt counter
      await pool.query(
        `UPDATE mfa_tokens SET attempts = attempts + 1
         WHERE created_by = ? AND token = ? AND is_used = FALSE`,
        [userId, code]
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid or expired verification code'
      });
    }

    const token = tokens[0];

    // Check attempt limit (max 5 attempts)
    if (token.attempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please request a new code.'
      });
    }

    // Mark token as used
    await pool.query(
      'UPDATE mfa_tokens SET is_used = TRUE, used_at = NOW() WHERE id = ?',
      [token.id]
    );

    // Enable 2FA for user
    await pool.query(
      `UPDATE users
       SET mfa_enabled = TRUE, mfa_method = 'email', mfa_enabled_at = NOW()
       WHERE id = ?`,
      [userId]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, '2FA_ENABLED', 'user', userId, JSON.stringify({ method: 'email' }), req.ip]
    );

    res.json({
      success: true,
      message: '2FA enabled successfully! You will need to enter a verification code on your next login.'
    });

  } catch (error) {
    console.error('Error verifying and enabling 2FA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable 2FA. Please try again.'
    });
  }
};

/**
 * @route   POST /api/mfa/disable
 * @desc    Disable 2FA for user (requires password confirmation)
 * @access  Private
 */
const disable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    // Validate password is provided
    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password confirmation is required'
      });
    }

    // Get user from database
    const [users] = await pool.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Check if 2FA is enabled
    if (!user.mfa_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled for your account'
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Disable 2FA
    await pool.query(
      `UPDATE users
       SET mfa_enabled = FALSE, mfa_method = 'email', mfa_enabled_at = NULL
       WHERE id = ?`,
      [userId]
    );

    // Delete all unused tokens for this user
    await pool.query(
      'DELETE FROM mfa_tokens WHERE created_by = ? AND is_used = FALSE',
      [userId]
    );

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, '2FA_DISABLED', 'user', userId, JSON.stringify({ method: 'email' }), req.ip]
    );

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable 2FA. Please try again.'
    });
  }
};

/**
 * @route   POST /api/mfa/send-code
 * @desc    Generate and send 2FA code during login
 * @access  Public (but requires valid user session)
 */
const send2FACodeForLogin = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get user from database
    const [users] = await pool.query(
      'SELECT id, email, full_name, mfa_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Check if 2FA is enabled
    if (!user.mfa_enabled) {
      return res.status(400).json({
        success: false,
        error: '2FA is not enabled for this user'
      });
    }

    // Invalidate any previous unused codes
    await pool.query(
      'UPDATE mfa_tokens SET is_used = TRUE WHERE created_by = ? AND is_used = FALSE',
      [userId]
    );

    // Generate new code
    const code = generate2FACode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store code in database
    await pool.query(
      `INSERT INTO mfa_tokens (user_id, token, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, code, expiresAt, req.ip]
    );

    // Send code via email
    try {
      await send2FACode(user.email, user.full_name, code);
    } catch (emailError) {
      console.error('Failed to send 2FA code:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification code. Please try again.'
      });
    }

    // Log audit event
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES (?, '2FA_CODE_SENT', 'user', ?, ?, ?)`,
      [userId, userId, req.ip]
    );

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
      expiresIn: 600 // seconds
    });

  } catch (error) {
    console.error('Error sending 2FA code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification code. Please try again.'
    });
  }
};

/**
 * @route   POST /api/mfa/verify
 * @desc    Verify 2FA code during login
 * @access  Public (but requires valid user session)
 */
const verify2FACode = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        error: 'User ID and verification code are required'
      });
    }

    if (code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code format'
      });
    }

    // Find valid token
    const [tokens] = await pool.query(
      `SELECT * FROM mfa_tokens
       WHERE created_by = ? AND token = ? AND is_used = FALSE AND end_time > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (tokens.length === 0) {
      // Increment attempt counter
      await pool.query(
        `UPDATE mfa_tokens SET attempts = attempts + 1
         WHERE created_by = ? AND token = ? AND is_used = FALSE`,
        [userId, code]
      );

      // Log failed attempt
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, '2FA_CODE_FAILED', 'user', ?, JSON_OBJECT('code', ?), ?, ?)`,
        [userId, userId, code, req.ip]
      );

      return res.status(401).json({
        success: false,
        error: 'Invalid or expired verification code'
      });
    }

    const token = tokens[0];

    // Check attempt limit (max 5 attempts)
    if (token.attempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many attempts. Please request a new code.'
      });
    }

    // Mark token as used
    await pool.query(
      'UPDATE mfa_tokens SET is_used = TRUE, used_at = NOW() WHERE id = ?',
      [token.id]
    );

    // Log successful verification
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES (?, '2FA_CODE_VERIFIED', 'user', ?, ?, ?)`,
      [userId, userId, req.ip]
    );

    // Get user data for login completion
    const [users] = await pool.query(
      `SELECT u.*, creator.full_name as created_by_name,
       CONVERT_TZ(u.last_login, @@session.time_zone, '+00:00') as last_login_utc,
       CONVERT_TZ(u.created_at, @@session.time_zone, '+00:00') as created_at_utc,
       CONVERT_TZ(u.updated_at, @@session.time_zone, '+00:00') as updated_at_utc
       FROM users u
       LEFT JOIN users creator ON u.created_by = creator.id
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Update last login time and set online status
    await pool.query(
      'UPDATE users SET last_login = NOW(), is_online = TRUE WHERE id = ?',
      [userId]
    );

    // Get user's regions
    const [regions] = await pool.query(
      `SELECT r.id, r.name, r.code, r.type, ur.access_level
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true`,
      [userId]
    );

    // Generate tokens
    const authToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      id: user.id
    });

    // Create session record
    try {
      const sessionToken = crypto.createHash('sha256').update(authToken).digest('hex');
      const deviceInfo = req.get('User-Agent') || 'Unknown Device';
      const ipAddress = req.ip || req.connection.remoteAddress;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await pool.query(
        `INSERT INTO user_sessions (session_token, user_id, token, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionToken, userId, authToken, ipAddress, deviceInfo, expiresAt]
      );
    } catch (sessionError) {
      console.error('Failed to create session record:', sessionError);
    }

    // Map regions to names
    const assignedRegions = regions.map(r => r.name);

    // Return complete login response with tokens
    res.json({
      success: true,
      message: '2FA verification successful',
      verified: true,
      token: authToken,
      refreshToken: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.full_name,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        phoneNumber: user.phone,
        department: user.department,
        officeLocation: user.office_location,
        office_location: user.office_location,
        gender: user.gender,
        street: user.street,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        address: {
          street: user.street,
          city: user.city,
          state: user.state,
          pincode: user.pincode
        },
        assignedRegions: assignedRegions,
        status: user.is_active ? 'Active' : 'Inactive',
        isActive: user.is_active,
        isEmailVerified: user.is_email_verified,
        createdBy: user.created_by,
        createdByName: user.created_by_name,
        createdAt: user.created_at_utc ? new Date(user.created_at_utc).toISOString() : null,
        updatedAt: user.updated_at_utc ? new Date(user.updated_at_utc).toISOString() : null,
        lastLogin: user.last_login_utc ? new Date(user.last_login_utc).toISOString() : null,
        last_login: user.last_login_utc ? new Date(user.last_login_utc).toISOString() : null
      }
    });

  } catch (error) {
    console.error('Error verifying 2FA code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code. Please try again.'
    });
  }
};

/**
 * @route   GET /api/mfa/status
 * @desc    Get 2FA status for current user
 * @access  Private
 */
const get2FAStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.query(
      'SELECT mfa_enabled, mfa_method, mfa_enabled_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      mfa: {
        enabled: user.mfa_enabled || false,
        method: user.mfa_method || 'email',
        enabledAt: user.mfa_enabled_at || null
      }
    });

  } catch (error) {
    console.error('Error getting 2FA status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get 2FA status'
    });
  }
};

/**
 * @route   POST /api/mfa/admin/force-enable/:userId
 * @desc    Admin forces user to enable 2FA on next login
 * @access  Private (Admin only)
 */
const adminForce2FA = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = req.user;

    // Check if admin
    if (adminUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can force 2FA for users'
      });
    }

    // Check if user exists
    const [users] = await pool.query('SELECT id, username, email FROM users WHERE id = ?', [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const targetUser = users[0];

    // Enable 2FA for user (admin can force enable)
    await pool.query(
      `UPDATE users SET
        mfa_enabled = TRUE,
        mfa_method = 'email',
        mfa_enabled_at = NOW(),
        updated_at = NOW()
      WHERE id = ?`,
      [userId]
    );

    // Get updated user data
    const [updatedUsers] = await pool.query(
      'SELECT id, username, email, mfa_enabled, mfa_method, mfa_enabled_at FROM users WHERE id = ?',
      [userId]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adminUser.id,
        'ADMIN_FORCE_2FA',
        'user',
        userId,
        JSON.stringify({
          target_user: targetUser.username,
          action: 'Admin enabled 2FA'
        }),
        req.ip
      ]
    );

    res.json({
      success: true,
      message: `2FA has been enabled for ${targetUser.username}`,
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Error forcing 2FA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force 2FA'
    });
  }
};

/**
 * @route   POST /api/mfa/admin/disable/:userId
 * @desc    Admin disables 2FA for a user (for lockout recovery)
 * @access  Private (Admin only)
 */
const adminDisable2FA = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = req.user;

    // Check if admin
    if (adminUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can disable user 2FA'
      });
    }

    // Check if user exists and has 2FA enabled
    const [users] = await pool.query(
      'SELECT id, username, email, mfa_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const targetUser = users[0];

    if (!targetUser.mfa_enabled) {
      return res.status(400).json({
        success: false,
        error: 'User does not have 2FA enabled'
      });
    }

    // Disable 2FA
    await pool.query(
      `UPDATE users SET
        mfa_enabled = FALSE,
        mfa_method = 'email',
        mfa_secret = NULL,
        mfa_enabled_at = NULL,
        updated_at = NOW()
      WHERE id = ?`,
      [userId]
    );

    // Delete any pending 2FA tokens
    await pool.query('DELETE FROM mfa_tokens WHERE created_by = ?', [userId]);

    // Get updated user data
    const [updatedUsers] = await pool.query(
      'SELECT id, username, email, mfa_enabled, mfa_method, mfa_enabled_at FROM users WHERE id = ?',
      [userId]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        adminUser.id,
        'ADMIN_DISABLE_2FA',
        'user',
        userId,
        JSON.stringify({
          target_user: targetUser.username,
          reason: 'Admin disabled 2FA'
        }),
        req.ip
      ]
    );

    res.json({
      success: true,
      message: `2FA has been disabled for ${targetUser.username}`,
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Error disabling user 2FA:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable 2FA'
    });
  }
};

module.exports = {
  enable2FA,
  verifyAndEnable2FA,
  disable2FA,
  send2FACodeForLogin,
  verify2FACode,
  get2FAStatus,
  adminForce2FA,
  adminDisable2FA
};
