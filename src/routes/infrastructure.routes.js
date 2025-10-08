const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllInfrastructure,
  getInfrastructureById,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  updateStatus,
  uploadPhoto
} = require('../controllers/infrastructureController');

router.use(authenticate);

router.get('/', getAllInfrastructure);
router.get('/:id', getInfrastructureById);
router.post('/', createInfrastructure);
router.put('/:id', updateInfrastructure);
router.delete('/:id', deleteInfrastructure);
router.patch('/:id/status', updateStatus);
router.post('/:id/upload-photo', uploadPhoto);

module.exports = router;
