const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllTemporaryAccess,
  grantTemporaryAccess,
  revokeTemporaryAccess,
  getMyTemporaryAccess,
  getCurrentValidRegions,
  cleanupExpired
} = require('../controllers/temporaryAccessController');

router.use(authenticate);

// User endpoints (must be before /:id routes)
router.get('/my-access', getMyTemporaryAccess);
router.get('/current-regions', getCurrentValidRegions);

// Admin/Manager endpoints
router.get('/', getAllTemporaryAccess);
router.post('/', grantTemporaryAccess);
router.post('/cleanup', cleanupExpired); // Admin: Manual cleanup
router.delete('/:id', revokeTemporaryAccess);

module.exports = router;
