const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDashboardAnalytics,
  getUserAnalytics,
  getRegionAnalytics,
  getFeatureAnalytics,
  trackEvent,
  getPerformanceMetrics,
  getUsageTrends,
  getSystemHealth,
  getRecentActivity,
  getInfrastructureStats,
  getUserStats,
  getSystemOverview
} = require('../controllers/analyticsController');

router.use(authenticate);

// Dashboard analytics
router.get('/dashboard', getDashboardAnalytics);
router.get('/users', getUserAnalytics);
router.get('/regions', getRegionAnalytics);
router.get('/features', getFeatureAnalytics);
router.post('/track', trackEvent);

// Performance and usage analytics
router.get('/performance', getPerformanceMetrics);
router.get('/usage-trends', getUsageTrends);
router.get('/system-health', getSystemHealth);
router.get('/recent-activity', getRecentActivity);
router.get('/infrastructure-stats', getInfrastructureStats);
router.get('/user-stats', getUserStats);
router.get('/system-overview', getSystemOverview);

module.exports = router;
