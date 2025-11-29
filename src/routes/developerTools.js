const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');

// Controllers
const securityScanController = require('../controllers/securityScanController');
const databaseBackupController = require('../controllers/databaseBackupController');
const envValidatorController = require('../controllers/envValidatorController');

/**
 * Developer Tools Routes
 * All routes require authentication and admin permissions
 */

// ========== Security Scanner Routes ==========
router.post(
  '/security/scan',
  authenticateToken,
  checkPermission('settings.view'), // Admin only
  securityScanController.runSecurityScan
);

router.get(
  '/security/history',
  authenticateToken,
  checkPermission('settings.view'),
  securityScanController.getScanHistory
);

router.get(
  '/security/scan/:scanId',
  authenticateToken,
  checkPermission('settings.view'),
  securityScanController.getScanDetails
);

// ========== Database Backup Routes ==========
router.post(
  '/backup/create',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.createBackup
);

router.get(
  '/backup/list',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.getBackups
);

router.get(
  '/backup/:backupId/download',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.downloadBackup
);

router.post(
  '/backup/:backupId/restore',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.restoreBackup
);

router.delete(
  '/backup/:backupId',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.deleteBackup
);

router.post(
  '/backup/schedule',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.scheduleBackup
);

router.get(
  '/backup/stats',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.getBackupStats
);

router.get(
  '/backup/:backupId/verify',
  authenticateToken,
  checkPermission('settings.view'),
  databaseBackupController.verifyBackup
);

// ========== Environment Validator Routes ==========
router.post(
  '/environment/validate',
  authenticateToken,
  checkPermission('settings.view'),
  envValidatorController.validateEnvironment
);

router.get(
  '/environment/history',
  authenticateToken,
  checkPermission('settings.view'),
  envValidatorController.getValidationHistory
);

router.get(
  '/environment/validation/:validationId',
  authenticateToken,
  checkPermission('settings.view'),
  envValidatorController.getValidationDetails
);

module.exports = router;
