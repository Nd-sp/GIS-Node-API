const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllProfiles,
  getProfileById,
  createProfile,
  deleteProfile,
  calculateElevation
} = require('../controllers/elevationProfileController');

router.use(authenticate);

router.get('/profiles', getAllProfiles);
router.get('/profiles/:id', getProfileById);
router.post('/profiles', createProfile);
router.delete('/profiles/:id', deleteProfile);
router.post('/calculate', calculateElevation);

module.exports = router;
