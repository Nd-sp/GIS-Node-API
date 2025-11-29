const express = require('express');
const router = express.Router();
const {
  getRegionBoundary,
  getRegionBoundaryHistory,
  updateRegionBoundary,
  getBoundaryChangeHistory,
  revertBoundaryToVersion
} = require('../controllers/regionBoundaryController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

/**
 * Region Boundary Management Routes
 * Base path: /api/regions
 */

// Get current active boundary for a region
// GET /api/regions/:regionId/boundary
router.get('/:regionId/boundary', authenticate, getRegionBoundary);

// Get all boundary versions (history) for a region
// GET /api/regions/:regionId/boundaries
router.get('/:regionId/boundaries', authenticate, authorize(['admin', 'manager']), getRegionBoundaryHistory);

// Update region boundary (creates new version)
// PUT /api/regions/:regionId/boundary
router.put('/:regionId/boundary', authenticate, authorize(['admin', 'manager']), updateRegionBoundary);

// Get change history for a region boundary
// GET /api/regions/:regionId/boundary-changes
router.get('/:regionId/boundary-changes', authenticate, authorize(['admin', 'manager']), getBoundaryChangeHistory);

// Revert boundary to a previous version
// POST /api/regions/:regionId/boundary/revert/:version
router.post('/:regionId/boundary/revert/:version', authenticate, authorize(['admin']), revertBoundaryToVersion);

module.exports = router;
