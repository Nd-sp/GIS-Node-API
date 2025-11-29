const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getUserPermissions,
  updateUserPermissions,
  addUserPermissions,
  removeUserPermissions
} = require('../controllers/userPermissionController');

// All routes require authentication
router.use(authenticate);

// User permission routes
router.get('/users/:userId/permissions', getUserPermissions);
router.put('/users/:userId/permissions', updateUserPermissions);
router.post('/users/:userId/permissions/add', addUserPermissions);
router.delete('/users/:userId/permissions/remove', removeUserPermissions);

module.exports = router;
