const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getPreferences,
  updatePreferences,
  resetPreferences
} = require('../controllers/preferencesController');

router.use(authenticate);

router.get('/', getPreferences);
router.put('/', updatePreferences);
router.delete('/', resetPreferences);

module.exports = router;
