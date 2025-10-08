const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
  getNearbyFeatures,
  getFeaturesByRegion
} = require('../controllers/featureController');

router.use(authenticate);

router.get('/', getAllFeatures);
router.get('/nearby', getNearbyFeatures);
router.get('/region/:regionId', getFeaturesByRegion);
router.get('/:id', getFeatureById);
router.post('/', createFeature);
router.put('/:id', updateFeature);
router.delete('/:id', deleteFeature);

module.exports = router;
