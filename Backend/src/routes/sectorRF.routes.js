const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllSectors,
  getSectorById,
  createSector,
  updateSector,
  deleteSector,
  calculateCoverage
} = require('../controllers/sectorRFController');

router.use(authenticate);

router.get('/', getAllSectors);
router.get('/:id', getSectorById);
router.post('/', createSector);
router.put('/:id', updateSector);
router.delete('/:id', deleteSector);
router.post('/:id/calculate', calculateCoverage);

module.exports = router;
