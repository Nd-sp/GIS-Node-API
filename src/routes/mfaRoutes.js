const express = require('express');
const router = express.Router();
const {
  enable2FA,
  verifyAndEnable2FA,
  disable2FA,
  send2FACodeForLogin,
  verify2FACode,
  get2FAStatus,
  adminForce2FA,
  adminDisable2FA
} = require('../controllers/mfaController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/mfa/status
 * @desc    Get 2FA status for current user
 * @access  Private
 */
router.get('/status', authenticate, get2FAStatus);

/**
 * @route   POST /api/mfa/enable
 * @desc    Enable 2FA (send test code)
 * @access  Private
 */
router.post('/enable', authenticate, enable2FA);

/**
 * @route   POST /api/mfa/verify-and-enable
 * @desc    Verify test code and fully enable 2FA
 * @access  Private
 */
router.post('/verify-and-enable', authenticate, verifyAndEnable2FA);

/**
 * @route   POST /api/mfa/disable
 * @desc    Disable 2FA
 * @access  Private
 */
router.post('/disable', authenticate, disable2FA);

/**
 * @route   POST /api/mfa/send-code
 * @desc    Send 2FA code during login (public but requires userId)
 * @access  Public
 */
router.post('/send-code', send2FACodeForLogin);

/**
 * @route   POST /api/mfa/verify
 * @desc    Verify 2FA code during login
 * @access  Public
 */
router.post('/verify', verify2FACode);

/**
 * @route   POST /api/mfa/admin/force-enable/:userId
 * @desc    Admin forces user to enable 2FA on next login
 * @access  Private (Admin only)
 */
router.post('/admin/force-enable/:userId', authenticate, adminForce2FA);

/**
 * @route   POST /api/mfa/admin/disable/:userId
 * @desc    Admin disables 2FA for a user
 * @access  Private (Admin only)
 */
router.post('/admin/disable/:userId', authenticate, adminDisable2FA);

module.exports = router;
