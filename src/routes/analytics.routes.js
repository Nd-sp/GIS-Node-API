const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDashboardAnalytics,
  getUserAnalytics,
  getRegionAnalytics,
  getFeatureAnalytics,
  trackEvent
} = require('../controllers/analyticsController');

router.use(authenticate);

router.get('/dashboard', getDashboardAnalytics);
router.get('/users', getUserAnalytics);
router.get('/regions', getRegionAnalytics);
router.get('/features', getFeatureAnalytics);
router.post('/track', trackEvent);

module.exports = router;
