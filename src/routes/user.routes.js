const express = require('express');
const router = express.Router();

// Import from split user controllers
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');

const {
  activateUser,
  deactivateUser
} = require('../controllers/userStatusController');

const {
  getUserRegions,
  assignRegion,
  unassignRegion
} = require('../controllers/userRegionController');

const {
  bulkDeleteUsers,
  bulkUpdateStatus,
  bulkAssignRegions
} = require('../controllers/userBulkController');

const {
  resetPassword,
  resendVerificationEmail,
  manualVerifyEmail
} = require('../controllers/userEmailController');

const {
  getUserSessionStats,
  forceLogoutUser,
  sendAdminMessage,
  getUserRecentActivity
} = require('../controllers/userSessionController');

const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/users - Get all users
router.get('/', authorize('admin', 'manager'), getAllUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// POST /api/users - Create user
router.post('/', authorize('admin'), createUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/bulk-delete - Bulk delete users (must be BEFORE /:id route)
router.delete('/bulk-delete', authorize('admin'), bulkDeleteUsers);

// PATCH /api/users/bulk-status - Bulk update user status (must be BEFORE /:id route)
router.patch('/bulk-status', authorize('admin'), bulkUpdateStatus);

// POST /api/users/bulk-assign-regions - Bulk assign regions to users (must be BEFORE /:id route)
router.post('/bulk-assign-regions', authorize('admin'), bulkAssignRegions);

// POST /api/admin/send-message - Send message from admin to user
router.post('/admin/send-message', authorize('admin'), sendAdminMessage);

// DELETE /api/users/:id - Delete user
router.delete('/:id', authorize('admin'), deleteUser);

// PATCH /api/users/:id/activate - Activate user
router.patch('/:id/activate', authorize('admin'), activateUser);

// PATCH /api/users/:id/deactivate - Deactivate user
router.patch('/:id/deactivate', authorize('admin'), deactivateUser);

// POST /api/users/:id/reset-password - Reset user password
router.post('/:id/reset-password', authorize('admin', 'manager'), resetPassword);

// PATCH /api/users/:id/verify-email-manual - Manually verify user's email (Admin only)
router.post('/:id/verify-email-manual', authorize('admin', 'manager'), manualVerifyEmail);

// POST /api/users/:id/resend-verification - Resend verification email (Admin only)
router.post('/:id/resend-verification', authorize('admin', 'manager'), resendVerificationEmail);

// GET /api/users/:id/regions - Get user regions
router.get('/:id/regions', getUserRegions);

// POST /api/users/:id/regions - Assign region
router.post('/:id/regions', authorize('admin'), assignRegion);

// DELETE /api/users/:id/regions/:regionId - Unassign region
router.delete('/:id/regions/:regionId', authorize('admin'), unassignRegion);

// GET /api/users/:id/session-stats - Get user session statistics
router.get('/:id/session-stats', authorize('admin'), getUserSessionStats);

// POST /api/users/:id/force-logout - Force logout user (Admin only)
router.post('/:id/force-logout', authorize('admin'), forceLogoutUser);

// GET /api/users/:id/recent-activity - Get user recent activity
router.get('/:id/recent-activity', authorize('admin'), getUserRecentActivity);

module.exports = router;
