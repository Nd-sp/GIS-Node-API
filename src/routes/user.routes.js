const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  getUserRegions,
  assignRegion,
  unassignRegion
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/users - Get all users
router.get('/', authorize('admin', 'manager'), getAllUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// POST /api/users - Create user
router.post('/', authorize('admin'), createUser);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', authorize('admin'), deleteUser);

// PATCH /api/users/:id/activate - Activate user
router.patch('/:id/activate', authorize('admin'), activateUser);

// PATCH /api/users/:id/deactivate - Deactivate user
router.patch('/:id/deactivate', authorize('admin'), deactivateUser);

// GET /api/users/:id/regions - Get user regions
router.get('/:id/regions', getUserRegions);

// POST /api/users/:id/regions - Assign region
router.post('/:id/regions', authorize('admin'), assignRegion);

// DELETE /api/users/:id/regions/:regionId - Unassign region
router.delete('/:id/regions/:regionId', authorize('admin'), unassignRegion);

module.exports = router;
