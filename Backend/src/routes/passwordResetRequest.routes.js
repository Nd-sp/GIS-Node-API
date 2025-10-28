const express = require('express');
const router = express.Router();
const {
  submitPasswordResetRequest,
  getAllPasswordResetRequests,
  getPasswordResetRequestById,
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
  deletePasswordResetRequest
} = require('../controllers/passwordResetRequestController');
const { authenticate, authorize } = require('../middleware/auth');

// POST /api/password-reset-requests - Submit password reset request (PUBLIC)
router.post('/', submitPasswordResetRequest);

// All routes below require authentication
router.use(authenticate);

// GET /api/password-reset-requests - Get all requests (Admin only)
router.get('/', authorize('admin'), getAllPasswordResetRequests);

// GET /api/password-reset-requests/:id - Get single request (Admin only)
router.get('/:id', authorize('admin'), getPasswordResetRequestById);

// POST /api/password-reset-requests/:id/approve - Approve request (Admin only)
router.post('/:id/approve', authorize('admin'), approvePasswordResetRequest);

// POST /api/password-reset-requests/:id/reject - Reject request (Admin only)
router.post('/:id/reject', authorize('admin'), rejectPasswordResetRequest);

// DELETE /api/password-reset-requests/:id - Delete request (Admin only)
router.delete('/:id', authorize('admin'), deletePasswordResetRequest);

module.exports = router;
