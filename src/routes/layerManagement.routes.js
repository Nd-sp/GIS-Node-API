const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllLayers,
  getLayerById,
  createLayer,
  updateLayer,
  deleteLayer,
  toggleVisibility,
  shareLayer
} = require('../controllers/layerManagementController');

router.use(authenticate);

router.get('/', getAllLayers);
router.get('/:id', getLayerById);
router.post('/', createLayer);
router.put('/:id', updateLayer);
router.delete('/:id', deleteLayer);
router.patch('/:id/visibility', toggleVisibility);
router.post('/:id/share', shareLayer);

module.exports = router;
