const { pool } = require('../config/database');
const { hashPassword } = require('../utils/bcrypt');
const { logAudit } = require('./auditController');
const { sendVerificationEmail } = require('../services/emailService');

/**
 * @route   POST /api/users/:id/reset-password
 * @desc    Reset user password (Admin/Manager only)
 * @access  Private (Admin/Manager)
 */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    console.log('=== RESET PASSWORD DEBUG ===');
    console.log('User ID to reset:', id);
    console.log('New password provided:', newPassword ? 'YES' : 'NO');
    console.log('New password length:', newPassword?.length);

    if (!newPassword) {
      return res.status(400).json({ success: false, error: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Get user details before password change
    const [users] = await pool.query(
      'SELECT username, email, full_name FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);
    console.log('Hashed password generated:', hashedPassword ? 'YES' : 'NO');

    // Update the password
    const [updateResult] = await pool.query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );
    console.log('Database update result:', updateResult);
    console.log('Rows affected:', updateResult.affectedRows);

    // Log audit
    await logAudit(req.user.id, 'PASSWORD_RESET', 'user', id, {
      reset_by: req.user.username,
      target_user: users[0].username
    }, req);

    console.log(`Password reset for user ${users[0].username} (ID: ${id}) by ${req.user.username}`);

    res.json({
      success: true,
      message: `Password reset successfully for ${users[0].full_name || users[0].username}`
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
};

/**
 * @route   POST /api/users/:id/resend-verification
 * @desc    Resend verification email for a user (Admin only)
 * @access  Private (Admin/Manager)
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user details
    const [users] = await pool.query(
      'SELECT id, username, email, is_email_verified FROM users WHERE id = ?',
      [id]
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
      return res.json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      });
    }

    // Send verification email
    try {
      await sendVerificationEmail(user);
      console.log(`✅ Verification email resent to ${user.email} by admin ${req.user.username}`);

      // Log audit
      await logAudit(req.user.id, 'RESEND_VERIFICATION', 'user', id, {
        email: user.email,
        username: user.username
      }, req);

      res.json({
        success: true,
        message: `Verification email sent to ${user.email}`
      });
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resend verification email'
    });
  }
};

/**
 * @route   POST /api/users/:id/verify-email-manual
 * @desc    Manually verify user's email (Admin only)
 * @access  Private (Admin/Manager)
 */
const manualVerifyEmail = async (req, res) => {
  try {
    const { id } = req.params;

    // Get user details
    const [users] = await pool.query(
      'SELECT id, username, email, is_email_verified FROM users WHERE id = ?',
      [id]
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
      return res.json({
        success: true,
        message: 'Email is already verified',
        alreadyVerified: true
      });
    }

    // Manually verify the email
    await pool.query(
      'UPDATE users SET is_email_verified = true, email_verified_at = NOW(), updated_at = NOW() WHERE id = ?',
      [id]
    );

    console.log(`✅ Email manually verified for user ${user.username} (ID: ${id}) by admin ${req.user.username}`);

    // Log audit
    await logAudit(req.user.id, 'MANUAL_VERIFY_EMAIL', 'user', id, {
      email: user.email,
      username: user.username,
      verified_by_admin: req.user.username
    }, req);

    res.json({
      success: true,
      message: `Email verified successfully for ${user.username}`
    });

  } catch (error) {
    console.error('Manual verify email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify email'
    });
  }
};

module.exports = {
  resetPassword,
  resendVerificationEmail,
  manualVerifyEmail
};
