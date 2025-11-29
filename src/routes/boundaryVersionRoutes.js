const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Import controllers
const boundaryVersionController = require('../controllers/boundaryVersionController');
const boundaryImpactController = require('../controllers/boundaryImpactController');
const boundaryPublishController = require('../controllers/boundaryPublishController');

// ============================================
// Boundary Versioning Routes
// ============================================

/**
 * GET /api/regions/:id/boundary-versions
 * Get all boundary versions (draft + published + archived) for a region
 * Access: Admin/Manager
 */
router.get(
  '/:id/boundary-versions',
  authenticate,
  boundaryVersionController.getRegionBoundaryVersions
);

/**
 * GET /api/regions/:id/boundary-version/draft
 * Get current draft boundary for a region (if exists)
 * Access: Admin/Manager
 */
router.get(
  '/:id/boundary-version/draft',
  authenticate,
  boundaryVersionController.getDraftBoundary
);

/**
 * POST /api/regions/:id/boundary-version/draft
 * Create or update draft boundary for a region
 * Access: Admin/Manager
 */
router.post(
  '/:id/boundary-version/draft',
  authenticate,
  boundaryVersionController.createOrUpdateDraft
);

/**
 * DELETE /api/regions/:id/boundary-version/draft
 * Discard draft boundary for a region
 * Access: Admin/Manager
 */
router.delete(
  '/:id/boundary-version/draft',
  authenticate,
  boundaryVersionController.discardDraft
);

/**
 * POST /api/regions/:id/boundary-version/:versionId/edit
 * Create a new draft from an existing published version for editing
 * Access: Admin/Manager
 */
router.post(
  '/:id/boundary-version/:versionId/edit',
  authenticate,
  boundaryVersionController.createDraftFromVersion
);

/**
 * DELETE /api/regions/:id/boundary-version/:versionId
 * Delete a specific boundary version (draft or published)
 * Access: Admin only
 */
router.delete(
  '/:id/boundary-version/:versionId',
  authenticate,
  boundaryVersionController.deleteBoundaryVersion
);

/**
 * DELETE /api/regions/:id/boundary-data
 * Delete ALL boundary data for a region (all versions, history, etc.)
 * Access: Admin only
 */
router.delete(
  '/:id/boundary-data',
  authenticate,
  boundaryVersionController.deleteAllBoundaryData
);

// ============================================
// Impact Analysis Routes
// ============================================

/**
 * POST /api/regions/:id/boundary-version/draft/analyze-impact
 * Analyze impact of publishing draft boundary
 * Access: Admin/Manager
 */
router.post(
  '/:id/boundary-version/draft/analyze-impact',
  authenticate,
  boundaryImpactController.analyzeImpact
);

/**
 * GET /api/regions/:id/infrastructure-history
 * Get infrastructure region change history for a region
 * Access: Admin/Manager
 */
router.get(
  '/:id/infrastructure-history',
  authenticate,
  boundaryImpactController.getInfrastructureHistory
);

// ============================================
// Publishing Routes
// ============================================

/**
 * POST /api/regions/:id/boundary-version/draft/publish
 * Publish draft boundary and migrate all infrastructure items
 * Access: Admin only
 */
router.post(
  '/:id/boundary-version/draft/publish',
  authenticate,
  boundaryPublishController.publishDraftBoundary
);

/**
 * POST /api/regions/:id/boundary-version/:versionId/rollback
 * Rollback to a previous boundary version (within 30 days)
 * Access: Admin only
 */
router.post(
  '/:id/boundary-version/:versionId/rollback',
  authenticate,
  boundaryPublishController.rollbackBoundaryVersion
);

/**
 * POST /api/regions/:id/boundary-version/unpublish
 * Unpublish (archive) the current published boundary
 * Access: Admin only
 */
router.post(
  '/:id/boundary-version/unpublish',
  authenticate,
  boundaryPublishController.unpublishBoundary
);

module.exports = router;
