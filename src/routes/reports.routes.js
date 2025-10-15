const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getRegionUsageReport,
  getUserActivityReport,
  getAccessDenialsReport,
  getAuditLogsReport,
  getTemporaryAccessReport,
  getRegionRequestsReport,
  getZoneAssignmentsReport,
  getComprehensiveReport
} = require('../controllers/reportsController');

// All reports routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Report endpoints - support ?format=json|csv|xlsx
router.get('/region-usage', getRegionUsageReport);
router.get('/user-activity', getUserActivityReport);
router.get('/access-denials', getAccessDenialsReport);
router.get('/audit-logs', getAuditLogsReport);
router.get('/temporary-access', getTemporaryAccessReport);
router.get('/region-requests', getRegionRequestsReport);
router.get('/zone-assignments', getZoneAssignmentsReport);
router.get('/comprehensive', getComprehensiveReport);

module.exports = router;
