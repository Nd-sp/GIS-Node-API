const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const userMapPreferencesController = require('../controllers/userMapPreferencesController');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/user-map-preferences
 * @desc    Get user's map preferences
 * @access  Private
 */
router.get('/', userMapPreferencesController.getUserPreferences);

/**
 * @route   POST /api/user-map-preferences
 * @desc    Save or update user's map preferences
 * @access  Private
 */
router.post('/', userMapPreferencesController.saveUserPreferences);

/**
 * @route   DELETE /api/user-map-preferences
 * @desc    Reset user's map preferences to default
 * @access  Private
 */
router.delete('/', userMapPreferencesController.resetUserPreferences);

module.exports = router;
