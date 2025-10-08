const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  updateMemberRole
} = require('../controllers/groupController');

router.use(authenticate);

router.get('/', getAllGroups);
router.get('/:id', getGroupById);
router.post('/', createGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);
router.get('/:id/members', getGroupMembers);
router.post('/:id/members', addGroupMember);
router.delete('/:id/members/:userId', removeGroupMember);
router.patch('/:id/members/:userId', updateMemberRole);

module.exports = router;
