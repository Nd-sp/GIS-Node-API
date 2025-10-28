const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllProfiles,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  calculateElevation
} = require('../controllers/elevationProfileController');

router.use(authenticate);

// Primary endpoints (used by frontend)
router.get('/', getAllProfiles);
router.get('/:id', getProfileById);
router.post('/', createProfile);
router.put('/:id', updateProfile);
router.delete('/:id', deleteProfile);

// Legacy endpoints (backward compatibility)
router.get('/profiles', getAllProfiles);
router.get('/profiles/:id', getProfileById);
router.post('/profiles', createProfile);
router.put('/profiles/:id', updateProfile);
router.delete('/profiles/:id', deleteProfile);
router.post('/calculate', calculateElevation);

module.exports = router;
