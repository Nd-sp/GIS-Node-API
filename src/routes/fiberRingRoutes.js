/**
 * Fiber Ring Routes
 * API endpoints for fiber ring management
 */

const express = require('express');
const router = express.Router();

// Middleware
const { authenticate } = require('../middleware/auth');

// Controllers
const {
  getAllFiberRings,
  getFiberRingById,
  createFiberRing,
  updateFiberRing,
  deleteFiberRing
} = require('../controllers/fiberRingController');

const {
  getRingSites,
  addRingSite,
  updateRingSite,
  deleteRingSite
} = require('../controllers/fiberRingSitesController');

// ============================================
// Fiber Ring CRUD Routes
// ============================================

/**
 * @route GET /api/fiber-rings
 * @desc Get all fiber rings (with optional filters)
 * @access Private
 * @query region_id, status, owner, temporary, limit, offset
 */
router.get('/fiber-rings',
  authenticate,
  getAllFiberRings
);

/**
 * @route GET /api/fiber-rings/:id
 * @desc Get single fiber ring with full details
 * @access Private
 * @params id - Fiber ring ID
 */
router.get('/fiber-rings/:id',
  authenticate,
  getFiberRingById
);

/**
 * @route POST /api/fiber-rings
 * @desc Create new fiber ring
 * @access Private
 * @body name, description, coordinates, fiber_type, fiber_count, etc.
 */
router.post('/fiber-rings',
  authenticate,
  createFiberRing
);

/**
 * @route PUT /api/fiber-rings/:id
 * @desc Update existing fiber ring
 * @access Private
 * @params id - Fiber ring ID
 * @body Any fields to update
 */
router.put('/fiber-rings/:id',
  authenticate,
  async (req, res, next) => {
    // Check ownership for edit permission
    // For now, allow edit if user is authenticated
    // TODO: Add permission check (fiber.edit.own vs fiber.edit.any)
    next();
  },
  updateFiberRing
);

/**
 * @route DELETE /api/fiber-rings/:id
 * @desc Delete fiber ring
 * @access Private
 * @params id - Fiber ring ID
 */
router.delete('/fiber-rings/:id',
  authenticate,
  async (req, res, next) => {
    // Check ownership for delete permission
    // For now, allow delete if user is authenticated
    // TODO: Add permission check (fiber.delete.own vs fiber.delete.any)
    next();
  },
  deleteFiberRing
);

// ============================================
// Site Management Routes
// ============================================

/**
 * @route GET /api/fiber-rings/:ringId/sites
 * @desc Get all sites for a fiber ring
 * @access Private
 * @params ringId - Fiber ring ID
 */
router.get('/fiber-rings/:ringId/sites',
  authenticate,
  getRingSites
);

/**
 * @route POST /api/fiber-rings/:ringId/sites
 * @desc Add new site to fiber ring
 * @access Private
 * @params ringId - Fiber ring ID
 * @body site_name, site_type, latitude, longitude, etc.
 */
router.post('/fiber-rings/:ringId/sites',
  authenticate,
  addRingSite
);

/**
 * @route PUT /api/fiber-rings/sites/:siteId
 * @desc Update site details
 * @access Private
 * @params siteId - Site ID
 * @body Any fields to update
 */
router.put('/fiber-rings/sites/:siteId',
  authenticate,
  updateRingSite
);

/**
 * @route DELETE /api/fiber-rings/sites/:siteId
 * @desc Delete site from fiber ring
 * @access Private
 * @params siteId - Site ID
 */
router.delete('/fiber-rings/sites/:siteId',
  authenticate,
  deleteRingSite
);

module.exports = router;
