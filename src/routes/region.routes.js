const express = require('express');
const router = express.Router();
const {
  getAllRegions,
  getRegionById,
  createRegion,
  updateRegion,
  deleteRegion,
  getChildRegions,
  getRegionUsers,
  getRegionHierarchy
} = require('../controllers/regionController');
const {
  getRegionBoundary,
  getRegionBoundaryHistory,
  updateRegionBoundary,
  getBoundaryChangeHistory,
  revertBoundaryToVersion
} = require('../controllers/regionBoundaryController');
const { authenticate, authorize } = require('../middleware/auth');
const { cacheMiddleware, clearCacheOnMutation } = require('../middleware/cache');

// All routes require authentication
router.use(authenticate);

// GET /api/regions - Get all regions - 🚀 Cache 10 min (rarely changes)
router.get('/', cacheMiddleware(600), getAllRegions);

// GET /api/regions/hierarchy - Get hierarchy - 🚀 Cache 10 min
router.get('/hierarchy', cacheMiddleware(600), getRegionHierarchy);

// GET /api/regions/:id - Get region by ID
router.get('/:id', getRegionById);

// POST /api/regions - Create region
router.post('/', authorize('admin'), createRegion);

// PUT /api/regions/:id - Update region
router.put('/:id', authorize('admin'), updateRegion);

// DELETE /api/regions/:id - Delete region
router.delete('/:id', authorize('admin'), deleteRegion);

// GET /api/regions/:id/children - Get child regions
router.get('/:id/children', getChildRegions);

// GET /api/regions/:id/users - Get users in region
router.get('/:id/users', authorize('admin', 'manager'), getRegionUsers);

// ======================================
// Region Boundary Management Routes
// ======================================

// GET /api/regions/:id/boundary - Get current active boundary for a region
router.get('/:id/boundary', getRegionBoundary);

// GET /api/regions/:id/boundaries - Get all boundary versions (history) for a region
router.get('/:id/boundaries', authorize('admin', 'manager'), getRegionBoundaryHistory);

// PUT /api/regions/:id/boundary - Update region boundary (creates new version)
router.put('/:id/boundary', authorize('admin', 'manager'), updateRegionBoundary);

// GET /api/regions/:id/boundary-changes - Get change history for a region boundary
router.get('/:id/boundary-changes', authorize('admin', 'manager'), getBoundaryChangeHistory);

// POST /api/regions/:id/boundary/revert/:version - Revert boundary to a previous version
router.post('/:id/boundary/revert/:version', authorize('admin'), revertBoundaryToVersion);

module.exports = router;
