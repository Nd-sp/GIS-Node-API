const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getGroupPermissions,
  updateGroupPermissions,
  getGroupRegions,
  updateGroupRegions
} = require('../controllers/groupPermissionController');

// All routes require authentication
router.use(authenticate);

// Group permission routes
router.get('/groups/:groupId/permissions', getGroupPermissions);
router.put('/groups/:groupId/permissions', updateGroupPermissions);

// Group region assignment routes
router.get('/groups/:groupId/regions', getGroupRegions);
router.put('/groups/:groupId/regions', updateGroupRegions);

module.exports = router;
