const { pool } = require('../config/database');
const { hashPassword, comparePassword } = require('../utils/bcrypt');
const { generateToken, generateRefreshToken, verifyEmailToken } = require('../utils/jwt');
const { sendVerificationEmail } = require('../services/emailService');

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
        error: 'Email and password are required'
      });
    }

    // Find user by email
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
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

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login time
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
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

    // Map regions to just names for frontend
    const assignedRegions = regions.map(r => r.name);

    // Return user data and token
    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        department: user.department,
        office_location: user.office_location,
        gender: user.gender,
        street: user.street,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        assignedRegions: assignedRegions,  // Array of region names
        last_login: user.last_login
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
        username
      });
      console.log(`✅ Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue with registration even if email fails
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
      `SELECT id, username, email, full_name, role, phone, department,
              is_active, is_email_verified, last_login, created_at
       FROM users WHERE id = ?`,
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
    user.regions = regions;

    res.json({
      success: true,
      user
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
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
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
      'UPDATE users SET is_email_verified = true, updated_at = NOW() WHERE id = ?',
      [decoded.id]
    );

    console.log(`✅ Email verified for user ID: ${decoded.id}`);

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
      'SELECT id, username, email, is_email_verified FROM users WHERE email = ?',
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

module.exports = {
  login,
  register,
  getCurrentUser,
  changePassword,
  logout,
  verifyEmail,
  resendVerificationEmail
};
