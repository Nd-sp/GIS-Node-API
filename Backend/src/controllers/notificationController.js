const { pool } = require('../config/database');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for the authenticated user
 * @access  Private
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { unreadOnly = 'false' } = req.query;

    let query = `
      SELECT
        id,
        type,
        title,
        message,
        data,
        priority,
        is_read,
        read_at,
        created_at,
        expires_at,
        action_url,
        action_label
      FROM notifications
      WHERE user_id = ?
    `;

    const params = [userId];

    if (unreadOnly === 'true') {
      query += ' AND is_read = FALSE';
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const [notifications] = await pool.query(query, params);

    // Parse JSON data field if it's a string
    const formattedNotifications = notifications.map(notif => ({
      ...notif,
      data: notif.data ? (typeof notif.data === 'string' ? JSON.parse(notif.data) : notif.data) : null
    }));

    res.json({
      success: true,
      notifications: formattedNotifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
};

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      count: result[0].count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unread count'
    });
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
};

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
};

/**
 * @route   DELETE /api/notifications/clear-all
 * @desc    Delete all read notifications
 * @access  Private
 */
const clearAllRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM notifications WHERE user_id = ? AND is_read = TRUE',
      [userId]
    );

    res.json({
      success: true,
      message: 'All read notifications cleared'
    });
  } catch (error) {
    console.error('Clear all read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear notifications'
    });
  }
};

/**
 * Helper function to create a notification
 * @param {Number} userId - User ID to notify
 * @param {String} type - Notification type
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {Object} options - Additional options (data, priority, action_url, action_label, expires_at)
 */
const createNotification = async (userId, type, title, message, options = {}) => {
  try {
    const {
      data = null,
      priority = 'medium',
      action_url = null,
      action_label = null,
      expires_at = null
    } = options;

    await pool.query(
      `INSERT INTO notifications
       (user_id, type, title, message, data, priority, action_url, action_label, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        type,
        title,
        message,
        data ? JSON.stringify(data) : null,
        priority,
        action_url,
        action_label,
        expires_at
      ]
    );

    console.log(`✅ Notification created for user ${userId}: ${title}`);
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * Helper function to notify all admins
 * @param {String} type - Notification type
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {Object} options - Additional options
 */
const notifyAllAdmins = async (type, title, message, options = {}) => {
  try {
    // Get all admin users
    const [admins] = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE"
    );

    // Create notification for each admin
    const promises = admins.map(admin =>
      createNotification(admin.id, type, title, message, options)
    );

    await Promise.all(promises);

    console.log(`✅ Notified ${admins.length} admins: ${title}`);
  } catch (error) {
    console.error('Notify all admins error:', error);
    throw error;
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllRead,
  createNotification,
  notifyAllAdmins
};
