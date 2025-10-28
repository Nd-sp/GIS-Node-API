const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllPolygons,
  getPolygonById,
  createPolygon,
  updatePolygon,
  deletePolygon
} = require('../controllers/polygonDrawingController');

router.use(authenticate);

router.get('/', getAllPolygons);
router.get('/:id', getPolygonById);
router.post('/', createPolygon);
router.put('/:id', updatePolygon);
router.delete('/:id', deletePolygon);

module.exports = router;
