const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllRequests,
  createRequest,
  approveRequest,
  rejectRequest,
  deleteRequest
} = require('../controllers/regionRequestController');

router.use(authenticate);

router.get('/', getAllRequests);
router.post('/', createRequest);
router.patch('/:id/approve', approveRequest);
router.patch('/:id/reject', rejectRequest);
router.delete('/:id', deleteRequest);

module.exports = router;
