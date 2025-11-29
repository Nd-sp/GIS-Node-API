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

console.log('🔄 Loading password reset routes (PUBLIC POST endpoint without auth)');

// POST /api/password-reset-requests - Submit password reset request (PUBLIC - NO AUTH)
router.post('/', submitPasswordResetRequest);

// GET /api/password-reset-requests - Get all requests (Admin only)
router.get('/', authenticate, authorize('admin'), getAllPasswordResetRequests);

// GET /api/password-reset-requests/:id - Get single request (Admin only)
router.get('/:id', authenticate, authorize('admin'), getPasswordResetRequestById);

// POST /api/password-reset-requests/:id/approve - Approve request (Admin only)
router.post('/:id/approve', authenticate, authorize('admin'), approvePasswordResetRequest);

// POST /api/password-reset-requests/:id/reject - Reject request (Admin only)
router.post('/:id/reject', authenticate, authorize('admin'), rejectPasswordResetRequest);

// DELETE /api/password-reset-requests/:id - Delete request (Admin only)
router.delete('/:id', authenticate, authorize('admin'), deletePasswordResetRequest);

module.exports = router;
