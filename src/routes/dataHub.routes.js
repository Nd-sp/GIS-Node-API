const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
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

router.get('/all', getAllData);
router.post('/import', importData);
router.get('/imports', getImportHistory);
router.post('/export', exportData);
router.get('/exports', getExportHistory);
router.get('/exports/:id/download', downloadExport);

// Delete routes
router.delete('/delete/:type/:id', deleteSingleData);
router.delete('/delete-bulk/:type', deleteBulkData);

module.exports = router;
