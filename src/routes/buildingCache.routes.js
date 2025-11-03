const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  saveBuildingCache,
  getBuildingCache,
  queryBuildingCache,
  cleanupExpiredCache,
  getCacheStatistics
} = require('../controllers/buildingCacheController');

// All routes require authentication
router.use(authenticate);

// Cache management routes
router.post('/', saveBuildingCache);                    // Save cache
router.get('/:cacheKey', getBuildingCache);             // Get cache by key
router.post('/query', queryBuildingCache);              // Query by bbox
router.delete('/cleanup', cleanupExpiredCache);         // Cleanup expired (Admin)
router.get('/admin/stats', getCacheStatistics);         // Get statistics (Admin)

module.exports = router;
