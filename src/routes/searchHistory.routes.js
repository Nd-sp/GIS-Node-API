const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const searchHistoryController = require('../controllers/searchHistoryController');

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/search-history
 * @desc    Get user's search history
 * @access  Private
 * @query   limit, offset
 */
router.get('/', searchHistoryController.getSearchHistory);

/**
 * @route   GET /api/search-history/recent
 * @desc    Get recent unique search queries
 * @access  Private
 * @query   limit
 */
router.get('/recent', searchHistoryController.getRecentSearches);

/**
 * @route   GET /api/search-history/stats
 * @desc    Get search statistics
 * @access  Private
 */
router.get('/stats', searchHistoryController.getSearchStats);

/**
 * @route   POST /api/search-history
 * @desc    Add search to history
 * @access  Private
 */
router.post('/', searchHistoryController.addSearchToHistory);

/**
 * @route   DELETE /api/search-history
 * @desc    Clear user's search history
 * @access  Private
 */
router.delete('/', searchHistoryController.clearSearchHistory);

/**
 * @route   DELETE /api/search-history/:id
 * @desc    Delete a specific search from history
 * @access  Private
 */
router.delete('/:id', searchHistoryController.deleteSearch);

module.exports = router;
