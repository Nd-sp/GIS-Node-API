const express = require('express');
const router = express.Router();
const devToolsController = require('../controllers/devToolsController');
const securityScanController = require('../controllers/securityScanController');
const databaseBackupController = require('../controllers/databaseBackupController');
const envValidatorController = require('../controllers/envValidatorController');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

// All routes require authentication and devtools permissions
router.use(authenticate);

// Run analysis
router.post(
  '/analyze',
  checkPermission('devtools.run'),
  devToolsController.runAnalysis
);

// Get analysis status
router.get(
  '/analyze/status/:reportId',
  checkPermission('devtools.view'),
  devToolsController.getAnalysisStatus
);

// Get all reports
router.get(
  '/reports',
  checkPermission('devtools.view'),
  devToolsController.getAllReports
);

// Download report
router.get(
  '/reports/:reportId/download',
  checkPermission('devtools.download'),
  devToolsController.downloadReport
);

// Delete report
router.delete(
  '/reports/:reportId',
  checkPermission('devtools.delete'),
  devToolsController.deleteReport
);

// Get user settings
router.get(
  '/settings',
  checkPermission('devtools.view'),
  devToolsController.getUserSettings
);

// Update user settings
router.put(
  '/settings',
  checkPermission('devtools.view'),
  devToolsController.updateUserSettings
);

// ========== Props Analysis Routes ==========
router.post(
  '/props-analysis',
  checkPermission('devtools.run'),
  devToolsController.runPropsAnalysis
);

router.get(
  '/props-analysis/:reportId',
  checkPermission('devtools.view'),
  devToolsController.getPropsAnalysisResult
);

// ========== API Performance Analysis Routes ==========
router.post(
  '/api-analysis',
  checkPermission('devtools.run'),
  devToolsController.runAPIAnalysis
);

router.get(
  '/api-analysis/:reportId',
  checkPermission('devtools.view'),
  devToolsController.getAPIAnalysisResult
);

// ========== Security Scanner Routes ==========
router.post(
  '/security/scan',
  checkPermission('devtools.run'),
  securityScanController.runSecurityScan
);

router.get(
  '/security/history',
  checkPermission('devtools.view'),
  securityScanController.getScanHistory
);

router.get(
  '/security/scan/:scanId',
  checkPermission('devtools.view'),
  securityScanController.getScanDetails
);

router.delete(
  '/security/scan/:scanId',
  checkPermission('devtools.delete'),
  securityScanController.deleteScan
);

// ========== Database Backup Routes ==========
router.post(
  '/backup/create',
  checkPermission('devtools.run'),
  databaseBackupController.createBackup
);

router.get(
  '/backup/list',
  checkPermission('devtools.view'),
  databaseBackupController.getBackups
);

router.get(
  '/backup/:backupId/download',
  checkPermission('devtools.download'),
  databaseBackupController.downloadBackup
);

router.post(
  '/backup/:backupId/restore',
  checkPermission('devtools.run'),
  databaseBackupController.restoreBackup
);

router.delete(
  '/backup/:backupId',
  checkPermission('devtools.delete'),
  databaseBackupController.deleteBackup
);

router.post(
  '/backup/schedule',
  checkPermission('devtools.run'),
  databaseBackupController.scheduleBackup
);

router.get(
  '/backup/stats',
  checkPermission('devtools.view'),
  databaseBackupController.getBackupStats
);

router.get(
  '/backup/:backupId/verify',
  checkPermission('devtools.view'),
  databaseBackupController.verifyBackup
);

// ========== Environment Validator Routes ==========
router.post(
  '/environment/validate',
  checkPermission('devtools.run'),
  envValidatorController.validateEnvironment
);

router.get(
  '/environment/history',
  checkPermission('devtools.view'),
  envValidatorController.getValidationHistory
);

router.get(
  '/environment/validation/:validationId',
  checkPermission('devtools.view'),
  envValidatorController.getValidationDetails
);

router.delete(
  '/environment/validation/:validationId',
  checkPermission('devtools.delete'),
  envValidatorController.deleteValidation
);

module.exports = router;
