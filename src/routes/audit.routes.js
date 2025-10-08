const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAuditLogs,
  getAuditLogById,
  getUserActivity
} = require('../controllers/auditController');

router.use(authenticate);

router.get('/logs', getAuditLogs);
router.get('/logs/:id', getAuditLogById);
router.get('/user/:userId', getUserActivity);

module.exports = router;
