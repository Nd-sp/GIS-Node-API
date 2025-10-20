const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllInfrastructure,
  getInfrastructureById,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  importKML,
  getImportPreview,
  saveImportedItems,
  deleteImportSession,
  getInfrastructureStats,
  getCategories
} = require('../controllers/infrastructureController');

// All routes require authentication
router.use(authenticate);

// Statistics (before :id route to avoid conflicts)
router.get('/stats', getInfrastructureStats);

// Categories endpoint (before :id route to avoid conflicts)
router.get('/categories', getCategories);

// KML Import endpoints (before :id route)
router.post('/import/kml', authorize('admin', 'manager'), importKML);
router.get('/import/:sessionId/preview', authorize('admin', 'manager'), getImportPreview);
router.post('/import/:sessionId/save', authorize('admin', 'manager'), saveImportedItems);
router.delete('/import/:sessionId', authorize('admin', 'manager'), deleteImportSession);

// CRUD operations
router.get('/', getAllInfrastructure);
router.get('/:id', getInfrastructureById);
router.post('/', createInfrastructure);
router.put('/:id', updateInfrastructure);
router.delete('/:id', deleteInfrastructure);

module.exports = router;
