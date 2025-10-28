const express = require('express');
const router = express.Router();
const {
  getAllMeasurements,
  getMeasurementById,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement
} = require('../controllers/distanceMeasurementController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

router.get('/', getAllMeasurements);
router.get('/:id', getMeasurementById);
router.post('/', createMeasurement);
router.put('/:id', updateMeasurement);
router.delete('/:id', deleteMeasurement);

module.exports = router;
