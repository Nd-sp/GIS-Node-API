const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark
} = require('../controllers/bookmarkController');

router.use(authenticate);

router.get('/', getAllBookmarks);
router.post('/', createBookmark);
router.put('/:id', updateBookmark);
router.delete('/:id', deleteBookmark);

module.exports = router;
