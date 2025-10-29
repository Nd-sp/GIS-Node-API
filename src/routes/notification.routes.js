const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllRead
} = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get my notifications
router.get('/', getMyNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', markAllAsRead);

// DELETE /api/notifications/clear-all - Clear all read notifications
router.delete('/clear-all', clearAllRead);

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', markAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;
