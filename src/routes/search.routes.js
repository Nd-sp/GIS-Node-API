const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  globalSearch,
  searchUsers,
  searchRegions,
  searchFeatures,
  getSearchHistory,
  deleteSearchHistory
} = require('../controllers/searchController');

router.use(authenticate);

router.get('/global', globalSearch);
router.get('/users', searchUsers);
router.get('/regions', searchRegions);
router.get('/features', searchFeatures);
router.get('/history', getSearchHistory);
router.delete('/history/:id', deleteSearchHistory);

module.exports = router;
