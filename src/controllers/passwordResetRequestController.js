const { pool } = require('../config/database');
const { hashPassword } = require('../utils/bcrypt');
const { notifyAllAdmins, createNotification } = require('./notificationController');
const { sendAdminPasswordResetEmail } = require('../services/emailService');

/**
 * @route   POST /api/password-reset-requests
 * @desc    Submit password reset request (Public - from login page)
 * @access  Public
 */
const submitPasswordResetRequest = async (req, res) => {
  try {
    const { username, reason } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log('\n🔐 PASSWORD RESET REQUEST RECEIVED');
    console.log(`   Username/Email: ${username}`);
    console.log(`   Reason: ${reason || 'Not provided'}`);
    console.log(`   IP: ${ipAddress}`);

    if (!username || username.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Username or email is required'
      });
    }

    // Try to find the user
    const [users] = await pool.query(
      `SELECT id, username, email, full_name
       FROM users
       WHERE username = ? OR email = ? OR CAST(id AS CHAR) = ?
       LIMIT 1`,
      [username, username, username]
    );

    if (users.length === 0) {
      console.log(`⚠️  User not found: ${username}`);
      console.log('   Rejecting request - user does not exist');
      return res.status(400).json({
        success: false,
        error: 'User not found. Please check your username/email or contact your administrator.'
      });
    }

    console.log(`✅ User found: ${users[0].username} (ID: ${users[0].id})`);

    const userId = users[0].id;
    const userFullName = users[0].full_name;

    // Create the request with a 24-hour expiry (increased from 1 hour for better UX)
    const token = require('crypto').randomBytes(32).toString('hex');

    console.log(`📅 Creating password reset request (using UTC timestamps)`);

    await pool.query(
      `INSERT INTO passwords_reset_requests
       (user_id, token, created_at, expires_at)
       VALUES (?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))`,
      [userId, token]
    );

    // Notify all admins
    await notifyAllAdmins(
      'password_reset_request',
      '🔐 New Password Reset Request',
      `${userFullName} (${username}) has requested a password reset.`,
      {
        data: {
          username,
          userId,
          ipAddress
        },
        priority: 'high',
        action_url: '/admin/password-reset-requests',
        action_label: 'View Request'
      }
    );

    console.log(`✅ Password reset request created and admins notified`);

    res.json({
      success: true,
      message: 'Password reset request submitted successfully. An administrator will process your request shortly.'
    });
  } catch (error) {
    console.error('❌ Submit password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit password reset request'
    });
  }
};

/**
 * @route   GET /api/password-reset-requests
 * @desc    Get all password reset requests (Admin only)
 * @access  Private/Admin
 */
const getAllPasswordResetRequests = async (req, res) => {
  try {
    const { status = 'all' } = req.query;

    let query = `
      SELECT
        prr.id,
        prr.user_id,
        prr.token,
        prr.created_at as requested_at,
        prr.expires_at,
        prr.used_at,
        CASE
          WHEN prr.used_at IS NOT NULL THEN 'completed'
          WHEN prr.used_at IS NULL AND prr.expires_at <= UTC_TIMESTAMP() THEN 'expired'
          ELSE 'pending'
        END as status,
        u.username,
        u.email,
        u.full_name
      FROM passwords_reset_requests prr
      LEFT JOIN users u ON prr.user_id = u.id
    `;

    const params = [];

    if (status === 'used' || status === 'completed') {
      query += ' HAVING status = \'completed\'';
    } else if (status === 'pending') {
      query += ' HAVING status = \'pending\'';
    } else if (status === 'expired' || status === 'rejected') {
      query += ' HAVING status = \'expired\'';
    }

    query += ' ORDER BY prr.created_at DESC LIMIT 100';

    const [requests] = await pool.query(query, params);

    // Log status distribution for debugging
    const statusCounts = {
      pending: requests.filter(r => r.status === 'pending').length,
      completed: requests.filter(r => r.status === 'completed').length,
      expired: requests.filter(r => r.status === 'expired').length
    };
    console.log(`📊 Password reset requests status distribution:`, statusCounts);
    console.log(`   Filter requested: ${status}`);
    console.log(`   Total returned: ${requests.length}`);

    // Log first request details if any exist
    if (requests.length > 0) {
      const first = requests[0];
      console.log(`   First request: ID=${first.id}, Status=${first.status}, Expires=${first.expires_at}`);
      console.log(`   Current UTC time: ${new Date().toISOString()}`);
    }

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Get password reset requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch password reset requests'
    });
  }
};

/**
 * @route   GET /api/password-reset-requests/:id
 * @desc    Get single password reset request (Admin only)
 * @access  Private/Admin
 */
const getPasswordResetRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const [requests] = await pool.query(
      `SELECT
        prr.id,
        prr.user_id,
        prr.token,
        prr.created_at,
        prr.expires_at,
        prr.used_at,
        u.username,
        u.email,
        u.full_name
      FROM passwords_reset_requests prr
      LEFT JOIN users u ON prr.user_id = u.id
      WHERE prr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Password reset request not found'
      });
    }

    res.json({
      success: true,
      request: requests[0]
    });
  } catch (error) {
    console.error('Get password reset request by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch password reset request'
    });
  }
};

/**
 * @route   POST /api/password-reset-requests/:id/approve
 * @desc    Approve password reset request and set new password (Admin only)
 * @access  Private/Admin
 */
const approvePasswordResetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const adminId = req.user.id;

    console.log('\n✅ APPROVING PASSWORD RESET REQUEST');
    console.log(`   Request ID: ${id}`);
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   New password provided: ${!!newPassword}`);
    console.log(`   New password length: ${newPassword ? newPassword.length : 0}`);

    if (!newPassword || newPassword.length < 6) {
      console.log('❌ Password validation failed');
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }

    // Get the request
    const [requests] = await pool.query(
      `SELECT prr.*, u.username, u.email, u.full_name
       FROM passwords_reset_requests prr
       LEFT JOIN users u ON prr.user_id = u.id
       WHERE prr.id = ?`,
      [id]
    );

    if (requests.length === 0) {
      console.log('❌ Request not found in database');
      return res.status(404).json({
        success: false,
        error: 'Password reset request not found'
      });
    }

    const request = requests[0];
    console.log(`✅ Request found - User ID: ${request.user_id}`);

    // Check if already used
    if (request.used_at) {
      console.log(`❌ Request already used at: ${request.used_at}`);
      return res.status(400).json({
        success: false,
        error: 'This request has already been used'
      });
    }

    // Check if expired
    if (new Date(request.expires_at) < new Date()) {
      console.log(`❌ Request expired at: ${request.expires_at}`);
      return res.status(400).json({
        success: false,
        error: 'This request has expired'
      });
    }

    if (!request.user_id) {
      console.log('❌ No user_id associated with this request');
      return res.status(400).json({
        success: false,
        error: 'User not found for this reset request'
      });
    }

    console.log('✅ All validations passed, proceeding with password reset...');

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedPassword, request.user_id]
    );

    // Mark request as used
    await pool.query(
      `UPDATE passwords_reset_requests
       SET used_at = NOW()
       WHERE id = ?`,
      [id]
    );

    // Send email to user with new credentials
    if (request.email) {
      try {
        await sendAdminPasswordResetEmail(
          {
            email: request.email,
            username: request.username,
            full_name: request.full_name || request.username
          },
          newPassword
        );
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the whole operation if email fails
      }
    }

    // Notify the user
    if (request.user_id) {
      await createNotification(
        request.user_id,
        'password_reset_request',
        '✅ Password Reset Approved',
        'Your password reset request has been approved. Check your email for the new password.',
        {
          priority: 'high'
        }
      );
    }

    console.log(`✅ Password reset request ${id} approved and completed`);

    res.json({
      success: true,
      message: 'Password reset request approved and new password set'
    });
  } catch (error) {
    console.error('❌ Approve password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve password reset request'
    });
  }
};

/**
 * @route   POST /api/password-reset-requests/:id/reject
 * @desc    Reject (delete) password reset request (Admin only)
 * @access  Private/Admin
 */
const rejectPasswordResetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    console.log('\n❌ REJECTING PASSWORD RESET REQUEST');
    console.log(`   Request ID: ${id}`);
    console.log(`   Admin ID: ${adminId}`);

    // Get the request
    const [requests] = await pool.query(
      'SELECT * FROM passwords_reset_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Password reset request not found'
      });
    }

    const request = requests[0];

    // Notify the user if they exist
    if (request.user_id) {
      await createNotification(
        request.user_id,
        'password_reset_request',
        '❌ Password Reset Request Rejected',
        'Your password reset request has been rejected. Please contact support for assistance.',
        {
          priority: 'high'
        }
      );
    }

    // Delete the request (rejection means deleting)
    await pool.query(
      'DELETE FROM passwords_reset_requests WHERE id = ?',
      [id]
    );

    console.log(`❌ Password reset request ${id} rejected and deleted`);

    res.json({
      success: true,
      message: 'Password reset request rejected'
    });
  } catch (error) {
    console.error('❌ Reject password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject password reset request'
    });
  }
};

/**
 * @route   DELETE /api/password-reset-requests/:id
 * @desc    Delete password reset request (Admin only)
 * @access  Private/Admin
 */
const deletePasswordResetRequest = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM passwords_reset_requests WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Password reset request deleted'
    });
  } catch (error) {
    console.error('Delete password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete password reset request'
    });
  }
};

module.exports = {
  submitPasswordResetRequest,
  getAllPasswordResetRequests,
  getPasswordResetRequestById,
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
  deletePasswordResetRequest
};
