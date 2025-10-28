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
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/regions - Get all regions
router.get('/', getAllRegions);

// GET /api/regions/hierarchy - Get hierarchy
router.get('/hierarchy', getRegionHierarchy);

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

module.exports = router;
