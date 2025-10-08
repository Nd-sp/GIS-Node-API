const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllRequests,
  createRequest,
  approveRequest,
  rejectRequest
} = require('../controllers/regionRequestController');

router.use(authenticate);

router.get('/', getAllRequests);
router.post('/', createRequest);
router.patch('/:id/approve', approveRequest);
router.patch('/:id/reject', rejectRequest);

module.exports = router;
