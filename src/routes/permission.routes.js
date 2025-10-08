const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllPermissions,
  getPermissionById,
  createPermission
} = require('../controllers/permissionController');

router.use(authenticate);

router.get('/', getAllPermissions);
router.get('/:id', getPermissionById);
router.post('/', createPermission);

module.exports = router;
