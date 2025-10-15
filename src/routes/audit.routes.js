const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAuditLogs,
  getAuditLogById,
  getUserActivity,
  createAuditLog,
  deleteAuditLog,
  clearAllAuditLogs
} = require('../controllers/auditController');

router.use(authenticate);

router.get('/logs', getAuditLogs);
router.post('/logs', createAuditLog);        // Create new audit log
router.get('/logs/:id', getAuditLogById);
router.get('/user/:userId', getUserActivity);

// Admin only routes
router.delete('/logs/:id', deleteAuditLog); // Delete single log
router.delete('/logs', clearAllAuditLogs);   // Clear all logs

module.exports = router;
