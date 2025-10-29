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

    // Create the request
    await pool.query(
      `INSERT INTO password_reset_requests
       (user_id, username_or_email, reason, status, ip_address, user_agent)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [userId, username, reason, ipAddress, userAgent]
    );

    // Notify all admins
    await notifyAllAdmins(
      'password_reset_request',
      '🔐 New Password Reset Request',
      `${userFullName} has requested a password reset.`,
      {
        data: {
          username,
          userId,
          reason,
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
        prr.username_or_email,
        prr.reason,
        prr.status,
        prr.requested_at,
        prr.reviewed_by,
        prr.reviewed_at,
        prr.review_note,
        prr.ip_address,
        u.username,
        u.email,
        u.full_name,
        u.is_active,
        reviewer.username as reviewer_username,
        reviewer.full_name as reviewer_name
      FROM password_reset_requests prr
      LEFT JOIN users u ON prr.user_id = u.id
      LEFT JOIN users reviewer ON prr.reviewed_by = reviewer.id
    `;

    const params = [];

    if (status !== 'all') {
      query += ' WHERE prr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY prr.requested_at DESC LIMIT 100';

    const [requests] = await pool.query(query, params);

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
        prr.*,
        u.username,
        u.email,
        u.full_name,
        u.is_active,
        reviewer.username as reviewer_username,
        reviewer.full_name as reviewer_name
      FROM password_reset_requests prr
      LEFT JOIN users u ON prr.user_id = u.id
      LEFT JOIN users reviewer ON prr.reviewed_by = reviewer.id
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
    const { newPassword, note } = req.body;
    const adminId = req.user.id;

    console.log('\n✅ APPROVING PASSWORD RESET REQUEST');
    console.log(`   Request ID: ${id}`);
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   Request body:`, req.body);
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
       FROM password_reset_requests prr
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
    console.log(`✅ Request found - Status: ${request.status}, User ID: ${request.user_id}`);

    if (request.status !== 'pending') {
      console.log(`❌ Request already processed - Current status: ${request.status}`);
      return res.status(400).json({
        success: false,
        error: 'This request has already been processed'
      });
    }

    if (!request.user_id) {
      console.log('❌ No user_id associated with this request');
      console.log(`   Username/Email entered: ${request.username_or_email}`);
      return res.status(400).json({
        success: false,
        error: `User not found. The username/email "${request.username_or_email}" does not exist in the system. Please create this user first before approving the password reset request.`
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

    // Update request status
    await pool.query(
      `UPDATE password_reset_requests
       SET status = 'completed',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_note = ?,
           new_password = ?
       WHERE id = ?`,
      [adminId, note, hashedPassword, id]
    );

    // Send email to user with new credentials
    if (request.email) {
      try {
        await sendAdminPasswordResetEmail(
          {
            email: request.email,
            username: request.username || request.username_or_email,
            full_name: request.full_name || request.username_or_email
          },
          newPassword // Send plain password in email (user will change it on first login)
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
 * @desc    Reject password reset request (Admin only)
 * @access  Private/Admin
 */
const rejectPasswordResetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user.id;

    console.log('\n❌ REJECTING PASSWORD RESET REQUEST');
    console.log(`   Request ID: ${id}`);
    console.log(`   Admin ID: ${adminId}`);

    // Get the request
    const [requests] = await pool.query(
      'SELECT * FROM password_reset_requests WHERE id = ?',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Password reset request not found'
      });
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'This request has already been processed'
      });
    }

    // Update request status
    await pool.query(
      `UPDATE password_reset_requests
       SET status = 'rejected',
           reviewed_by = ?,
           reviewed_at = NOW(),
           review_note = ?
       WHERE id = ?`,
      [adminId, note, id]
    );

    // Notify the user if they exist
    if (request.user_id) {
      await createNotification(
        request.user_id,
        'password_reset_request',
        '❌ Password Reset Request Rejected',
        note || 'Your password reset request has been rejected. Please contact support for assistance.',
        {
          priority: 'high'
        }
      );
    }

    console.log(`❌ Password reset request ${id} rejected`);

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

    await pool.query('DELETE FROM password_reset_requests WHERE id = ?', [id]);

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
