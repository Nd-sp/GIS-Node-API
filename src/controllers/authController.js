const { pool } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateToken, generateRefreshToken, verifyEmailToken } = require('../utils/jwt');
const { sendVerificationEmail, send2FACode } = require('../services/emailService');
const { notifyAllAdmins } = require('./notificationController');

/**
 * Generate a random 6-digit code for 2FA
 */
const generate2FACode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email/Username/UserID and password are required'
      });
    }

    // Find user by email, username, or user ID
    // Try to match against email, username, or id (if numeric)
    // Join with users table to get creator's name
    let query;
    let params;

    // Check if input is numeric (could be user ID)
    const isNumeric = /^\d+$/.test(email);

    if (isNumeric) {
      // Search by ID, username, or email
      // Convert timestamps to UTC for consistent timezone handling
      query = `SELECT u.*, creator.full_name as created_by_name,
               CONVERT_TZ(u.last_login, @@session.time_zone, '+00:00') as last_login_utc,
               CONVERT_TZ(u.created_at, @@session.time_zone, '+00:00') as created_at_utc,
               CONVERT_TZ(u.updated_at, @@session.time_zone, '+00:00') as updated_at_utc,
               CONVERT_TZ(u.email_verified_at, @@session.time_zone, '+00:00') as email_verified_at_utc,
               CONVERT_TZ(u.mfa_enabled_at, @@session.time_zone, '+00:00') as mfa_enabled_at_utc
               FROM users u
               LEFT JOIN users creator ON u.created_by = creator.id
               WHERE u.id = ? OR u.username = ? OR u.email = ?`;
      params = [parseInt(email), email, email];
    } else {
      // Search by email or username
      // Convert timestamps to UTC for consistent timezone handling
      query = `SELECT u.*, creator.full_name as created_by_name,
               CONVERT_TZ(u.last_login, @@session.time_zone, '+00:00') as last_login_utc,
               CONVERT_TZ(u.created_at, @@session.time_zone, '+00:00') as created_at_utc,
               CONVERT_TZ(u.updated_at, @@session.time_zone, '+00:00') as updated_at_utc,
               CONVERT_TZ(u.email_verified_at, @@session.time_zone, '+00:00') as email_verified_at_utc,
               CONVERT_TZ(u.mfa_enabled_at, @@session.time_zone, '+00:00') as mfa_enabled_at_utc
               FROM users u
               LEFT JOIN users creator ON u.created_by = creator.id
               WHERE u.email = ? OR u.username = ?`;
      params = [email, email];
    }

    const [users] = await pool.query(query, params);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Check if email is verified
    if (!user.is_email_verified) {
      return res.status(401).json({
        success: false,
        error: 'Please verify your email address before logging in. Check your email for the verification link.',
        emailNotVerified: true,
        email: user.email
      });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // 🔐 CHECK IF 2FA IS ENABLED
    if (user.mfa_enabled) {

      // Invalidate any previous unused codes
      await pool.query(
        'UPDATE mfa_tokens SET is_used = TRUE WHERE created_by = ? AND is_used = FALSE',
        [user.id]
      );

      // Generate new 2FA code
      const code = generate2FACode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store code in database
      await pool.query(
        `INSERT INTO mfa_tokens (user_id, token, expires_at, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, code, expiresAt, req.ip, req.headers['user-agent']]
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
         VALUES (?, '2FA_CODE_SENT', 'user', ?, ?)`,
        [user.id, user.id, req.ip]
      );

      // Return response indicating 2FA is required
      return res.json({
        success: true,
        require2FA: true,
        userId: user.id,
        email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email
        message: 'Verification code sent to your email',
        expiresIn: 600 // seconds
      });
    }

    // Update last login time and set online status
    await pool.query(
      'UPDATE users SET last_login = NOW(), is_online = TRUE WHERE id = ?',
      [user.id]
    );

    // Get user's ALL regions
    const [regions] = await pool.query(
      `SELECT r.id, r.name, r.code, r.type, ur.access_level
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true`,
      [user.id]
    );

    // Generate tokens
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    const refreshToken = generateRefreshToken({
      id: user.id
    });

    // Create session record for tracking
    try {
      const crypto = require('crypto');
      const sessionToken = crypto.createHash('sha256').update(token).digest('hex');
      const deviceInfo = req.get('User-Agent') || 'Unknown Device';
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Calculate expiration (7 days for refresh token)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await pool.query(
        `INSERT INTO user_sessions (session_token, user_id, token, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionToken, user.id, token, ipAddress, deviceInfo, expiresAt]
      );
    } catch (sessionError) {
      console.error('Failed to create session record:', sessionError);
      // Don't fail login if session tracking fails
    }

    // Map regions to just names for frontend
    const assignedRegions = regions.map(r => r.name);

    // Return user data and token
    // Use UTC-converted timestamps from MySQL query
    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.full_name,  // Add 'name' for frontend compatibility
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        phoneNumber: user.phone,  // Add phoneNumber for compatibility
        department: user.department,
        officeLocation: user.office_location,
        office_location: user.office_location,
        gender: user.gender,
        street: user.street,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        address: {  // Also provide nested address object for compatibility
          street: user.street,
          city: user.city,
          state: user.state,
          pincode: user.pincode
        },
        assignedRegions: assignedRegions,  // Array of region names
        status: user.is_active ? 'Active' : 'Inactive',
        isActive: user.is_active,
        isEmailVerified: user.is_email_verified,
        is_email_verified: user.is_email_verified,
        emailVerifiedAt: user.email_verified_at_utc ? new Date(user.email_verified_at_utc).toISOString() : null,
        email_verified_at: user.email_verified_at_utc ? new Date(user.email_verified_at_utc).toISOString() : null,
        manualVerification: user.manual_verification,
        manual_verification: user.manual_verification,
        emailVerifiedBy: user.email_verified_by,
        email_verified_by: user.email_verified_by,
        lastVerificationEmailSent: user.last_verification_email_sent,
        last_verification_email_sent: user.last_verification_email_sent,
        // Two-Factor Authentication fields
        mfaEnabled: user.mfa_enabled,
        mfa_enabled: user.mfa_enabled,
        mfaMethod: user.mfa_method || 'email',
        mfa_method: user.mfa_method || 'email',
        mfaEnabledAt: user.mfa_enabled_at_utc ? new Date(user.mfa_enabled_at_utc).toISOString() : null,
        mfa_enabled_at: user.mfa_enabled_at_utc ? new Date(user.mfa_enabled_at_utc).toISOString() : null,
        createdBy: user.created_by,
        createdByName: user.created_by_name,
        createdAt: user.created_at_utc ? new Date(user.created_at_utc).toISOString() : null,
        updatedAt: user.updated_at_utc ? new Date(user.updated_at_utc).toISOString() : null,
        lastLogin: user.last_login_utc ? new Date(user.last_login_utc).toISOString() : null,
        last_login: user.last_login_utc ? new Date(user.last_login_utc).toISOString() : null
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
};

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public (or Admin only - depends on your requirements)
 */
const register = async (req, res) => {
  try {
    const { username, email, password, full_name, role = 'viewer' } = req.body;

    // Validate input
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email or username already exists'
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert new user
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active)
       VALUES (?, ?, ?, ?, ?, true)`,
      [username, email, password_hash, full_name, role]
    );

    const userId = result.insertId;

    // Send verification email
    try {
      await sendVerificationEmail({
        id: userId,
        email,
        username,
        full_name,
        role,
        password // Send plain password before it's hashed
      });
      console.log(`✅ Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    // Notify all admins about new user registration
    try {
      await notifyAllAdmins(
        'user_activity',
        '👤 New User Registered',
        `${full_name} (${username}) has registered with email ${email}`,
        {
          data: {
            userId,
            username,
            email,
            fullName: full_name,
            role,
            emailVerified: false
          },
          priority: 'low',
          action_url: `/admin/users/${userId}`,
          action_label: 'View User'
        }
      );
      console.log(`📧 Admins notified about new user registration: ${username}`);
    } catch (notifError) {
      console.error('Failed to send notification to admins:', notifError);
      // Don't fail registration if notification fails
    }

    // Generate token (user can still login, but should verify email)
    const token = generateToken({
      id: userId,
      email,
      role
    });

    res.status(201).json({
      success: true,
      token,
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: userId,
        username,
        email,
        full_name,
        role,
        is_email_verified: false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const [users] = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.department,
              u.office_location, u.gender, u.street, u.city, u.state, u.pincode,
              u.is_active, u.is_email_verified, u.email_verified_at, u.manual_verification,
              u.email_verified_by, u.last_verification_email_sent,
              u.mfa_enabled, u.mfa_method, u.mfa_enabled_at,
              u.last_login, u.created_at, u.updated_at,
              u.created_by, creator.full_name as created_by_name,
              CONVERT_TZ(u.last_login, @@session.time_zone, '+00:00') as last_login_utc,
              CONVERT_TZ(u.created_at, @@session.time_zone, '+00:00') as created_at_utc,
              CONVERT_TZ(u.updated_at, @@session.time_zone, '+00:00') as updated_at_utc,
              CONVERT_TZ(u.email_verified_at, @@session.time_zone, '+00:00') as email_verified_at_utc,
              CONVERT_TZ(u.mfa_enabled_at, @@session.time_zone, '+00:00') as mfa_enabled_at_utc
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

    // Get user's regions
    const [regions] = await pool.query(
      `SELECT r.id, r.name, r.code, r.type, ur.access_level
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true`,
      [userId]
    );

    const user = users[0];
    const assignedRegions = regions.map(r => r.name);

    // Format user data for frontend consistency
    const formattedUser = {
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
      is_email_verified: user.is_email_verified,
      emailVerifiedAt: user.email_verified_at_utc ? new Date(user.email_verified_at_utc).toISOString() : null,
      email_verified_at: user.email_verified_at_utc ? new Date(user.email_verified_at_utc).toISOString() : null,
      manualVerification: user.manual_verification,
      manual_verification: user.manual_verification,
      emailVerifiedBy: user.email_verified_by,
      email_verified_by: user.email_verified_by,
      lastVerificationEmailSent: user.last_verification_email_sent,
      last_verification_email_sent: user.last_verification_email_sent,
      // Two-Factor Authentication fields
      mfaEnabled: user.mfa_enabled,
      mfa_enabled: user.mfa_enabled,
      mfaMethod: user.mfa_method || 'email',
      mfa_method: user.mfa_method || 'email',
      mfaEnabledAt: user.mfa_enabled_at_utc ? new Date(user.mfa_enabled_at_utc).toISOString() : null,
      mfa_enabled_at: user.mfa_enabled_at_utc ? new Date(user.mfa_enabled_at_utc).toISOString() : null,
      createdBy: user.created_by,
      createdByName: user.created_by_name,
      createdAt: user.created_at_utc ? new Date(user.created_at_utc).toISOString() : null,
      updatedAt: user.updated_at_utc ? new Date(user.updated_at_utc).toISOString() : null,
      lastLogin: user.last_login_utc ? new Date(user.last_login_utc).toISOString() : null,
      last_login: user.last_login_utc ? new Date(user.last_login_utc).toISOString() : null,
      regions: regions
    };

    res.json({
      success: true,
      user: formattedUser
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user data'
    });
  }
};

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Old password and new password are required'
      });
    }

    // Get current password hash
    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify old password
    const isPasswordValid = await comparePassword(oldPassword, users[0].password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPasswordHash, userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (userId) {
      // Set user offline status
      await pool.query(
        'UPDATE users SET is_online = FALSE WHERE id = ?',
        [userId]
      );
      console.log(`🚪 User ${userId} logged out - set to offline`);

      // Mark session as logged out
      if (token) {
        try {
          const crypto = require('crypto');
          const sessionToken = crypto.createHash('sha256').update(token).digest('hex');

          await pool.query(
            `UPDATE user_sessions
             SET is_active = FALSE,
                 logout_time = NOW(),
                 logout_type = 'user'
             WHERE session_token = ? AND user_id = ?`,
            [sessionToken, userId]
          );
          console.log(`✅ Session marked as logged out for user ${userId}`);
        } catch (sessionError) {
          console.error('Failed to update session:', sessionError);
        }
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if DB update fails, still return success for logout
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user's email address
 * @access  Public
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required'
      });
    }

    // Verify the token
    let decoded;
    try {
      decoded = verifyEmailToken(token);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message || 'Invalid or expired verification link'
      });
    }

    // Check if user exists
    const [users] = await pool.query(
      'SELECT id, email, is_email_verified FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Check if email is already verified
    if (user.is_email_verified) {
      return res.json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      });
    }

    // Update user's email verification status
    await pool.query(
      'UPDATE users SET is_email_verified = true, email_verified_at = NOW(), updated_at = NOW() WHERE id = ?',
      [decoded.id]
    );

    res.json({
      success: true,
      message: 'Email verified successfully! You can now login.',
      alreadyVerified: false
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Email verification failed. Please try again.'
    });
  }
};

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find user by email
    const [users] = await pool.query(
      'SELECT id, username, email, full_name, role, is_email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account exists with this email, a verification link has been sent.'
      });
    }

    const user = users[0];

    // Check if already verified
    if (user.is_email_verified) {
      return res.json({
        success: true,
        message: 'Email is already verified'
      });
    }

    // Send verification email
    try {
      await sendVerificationEmail(user);
      console.log(`✅ Verification email resent to ${email}`);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent! Please check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email. Please try again.'
    });
  }
};

/**
 * @route   PATCH /api/users/:userId/verify-email
 * @desc    Manually verify user's email (Admin only)
 * @access  Private/Admin
 */
const manualVerifyUserEmail = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id; // ID of admin performing the action

    // Get target user
    const [users] = await pool.query(
      'SELECT id, email, full_name, is_email_verified FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Check if already verified
    if (user.is_email_verified) {
      return res.status(400).json({
        success: false,
        error: 'User email is already verified'
      });
    }

    // Update user as verified
    await pool.query(
      `UPDATE users
       SET is_email_verified = TRUE,
           email_verified_at = NOW(),
           manual_verification = TRUE,
           email_verified_by = ?
       WHERE id = ?`,
      [adminId, userId]
    );

    console.log(`✅ Email manually verified for user ${userId} by admin ${adminId}`);

    // Send notification email to user
    try {
      const { sendManualVerificationNotification } = require('../services/emailService');
      await sendManualVerificationNotification(user.email, user.full_name);
      console.log(`📧 Manual verification notification sent to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send notification email:', emailError.message);
      // Don't fail the request if email fails
    }

    // Get admin details for audit log
    const [adminUsers] = await pool.query(
      'SELECT full_name FROM users WHERE id = ?',
      [adminId]
    );
    const adminName = adminUsers[0]?.full_name || 'Unknown Admin';

    res.json({
      success: true,
      message: 'User email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_email_verified: true,
        email_verified_at: new Date(),
        verified_by: adminName
      }
    });
  } catch (error) {
    console.error('❌ Manual verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user email',
      details: error.message
    });
  }
};

/**
 * @route   POST /api/users/:userId/resend-verification
 * @desc    Resend verification email to user (Admin only)
 * @access  Private/Admin
 */
const adminResendVerificationEmail = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id;

    console.log(`\n📧 ADMIN RESEND VERIFICATION REQUEST`);
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   Target User ID: ${userId}`);

    // Get target user
    const [users] = await pool.query(
      'SELECT id, username, email, full_name, role, is_email_verified FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Check if user has a valid email
    if (!user.email || user.email.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'User does not have a valid email address'
      });
    }

    // Check if already verified
    if (user.is_email_verified) {
      return res.status(400).json({
        success: false,
        error: 'User email is already verified'
      });
    }

    // Update last verification email sent timestamp
    await pool.query(
      'UPDATE users SET last_verification_email_sent = NOW() WHERE id = ?',
      [userId]
    );

    // Send verification email
    await sendVerificationEmail({
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    });

    console.log(`✅ Verification email resent to ${user.email} by admin ${adminId}`);

    res.json({
      success: true,
      message: `Verification email sent to ${user.email}`,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      }
    });
  } catch (error) {
    console.error('❌ Admin resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/auth/validate-session
 * @desc    Validate if current session is still active
 * @access  Private
 */
const validateSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;

    console.log(`🔍 [Validate Session] Checking for user: ${username} (ID: ${userId})`);

    // Check if user has any active sessions (user_sessions table has: id, created_at, last_activity)
    const [sessions] = await pool.query(
      'SELECT id, created_at, last_activity FROM user_sessions WHERE user_id = ? LIMIT 1',
      [userId]
    );

    console.log(`📊 [Validate Session] Active sessions found: ${sessions.length}`);

    if (sessions.length === 0) {
      console.log(`❌ [Validate Session] NO ACTIVE SESSIONS - Returning session terminated for user: ${username}`);
      return res.status(401).json({
        success: false,
        valid: false,
        error: 'Session has been terminated',
        sessionTerminated: true
      });
    }

    console.log(`✅ [Validate Session] Session valid for user: ${username}`);
    // Session is valid
    res.json({
      success: true,
      valid: true,
      session: {
        loginTime: sessions[0].login_time,
        lastActivity: sessions[0].last_activity_time
      }
    });

  } catch (error) {
    console.error('❌ [Validate Session] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate session'
    });
  }
};

module.exports = {
  login,
  register,
  getCurrentUser,
  changePassword,
  logout,
  verifyEmail,
  resendVerificationEmail,
  manualVerifyUserEmail,
  adminResendVerificationEmail,
  validateSession
};
