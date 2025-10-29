const express = require('express');
const router = express.Router();
const {
  login,
  register,
  getCurrentUser,
  changePassword,
  logout,
  verifyEmail,
  resendVerificationEmail,
  validateSession
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, getCurrentUser);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/change-password', authenticate, changePassword);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token
 * @access  Private
 */
router.get('/verify', authenticate, (req, res) => {
  res.json({
    success: true,
    valid: true,
    user: req.user
  });
});

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user's email address
 * @access  Public
 */
router.get('/verify-email/:token', (req, res, next) => {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  EMAIL VERIFICATION ROUTE HIT                          ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('📍 Route: GET /api/auth/verify-email/:token');
  console.log('🔗 Full URL:', req.originalUrl);
  console.log('🎫 Token param:', req.params.token ? req.params.token.substring(0, 50) + '...' : 'NO TOKEN');
  console.log('🌐 Origin:', req.headers.origin || 'No origin header');
  console.log('📝 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('════════════════════════════════════════════════════════\n');
  next();
}, verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 */
router.post('/resend-verification', resendVerificationEmail);

/**
 * @route   GET /api/auth/validate-session
 * @desc    Validate if current session is still active
 * @access  Private
 */
router.get('/validate-session', authenticate, validateSession);

module.exports = router;
