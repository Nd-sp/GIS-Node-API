const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');
const boundaryPublicController = require('../controllers/boundaryPublicController');

/**
 * GET /api/boundaries/published
 * Get published boundaries based on user's assigned regions
 * Access: All authenticated users (filtered by region assignments)
 * ⚠️ No cache - response is user-specific based on region assignments
 */
router.get(
  '/published',
  authenticate,
  boundaryPublicController.getAllPublishedBoundaries
);

/**
 * GET /api/boundaries/export
 * Export all published boundaries as JSON file (india.json format)
 * Access: Admin only
 */
router.get(
  '/export',
  authenticate,
  boundaryPublicController.exportBoundariesAsJSON
);

module.exports = router;
