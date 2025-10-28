const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllCircles,
  getCircleById,
  createCircle,
  updateCircle,
  deleteCircle
} = require('../controllers/circleDrawingController');

router.use(authenticate);

router.get('/', getAllCircles);
router.get('/:id', getCircleById);
router.post('/', createCircle);
router.put('/:id', updateCircle);
router.delete('/:id', deleteCircle);

module.exports = router;
