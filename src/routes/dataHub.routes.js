const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware, clearCacheOnMutation } = require('../middleware/cache');
const {
  getAllData,
  importData,
  getImportHistory,
  exportData,
  getExportHistory,
  downloadExport,
  deleteSingleData,
  deleteBulkData
} = require('../controllers/dataHubController');

router.use(authenticate);

// 🚀 CACHE: 1 min cache for DataHub (7 parallel queries)
router.get('/all', cacheMiddleware(60), getAllData);
router.post('/import', importData);
router.get('/imports', getImportHistory);
router.post('/export', exportData);
router.get('/exports', getExportHistory);
router.get('/exports/:id/download', downloadExport);

// Delete routes - Clear cache on mutation
router.delete('/delete/:type/:id', clearCacheOnMutation(['/api/datahub']), deleteSingleData);
router.delete('/delete-bulk/:type', clearCacheOnMutation(['/api/datahub']), deleteBulkData);

module.exports = router;
