const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllTemporaryAccess,
  grantTemporaryAccess,
  revokeTemporaryAccess
} = require('../controllers/temporaryAccessController');

router.use(authenticate);

router.get('/', getAllTemporaryAccess);
router.post('/', grantTemporaryAccess);
router.delete('/:id', revokeTemporaryAccess);

module.exports = router;
