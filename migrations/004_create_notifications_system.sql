-- Migration: Create notifications system
-- Date: 2025-01-28
-- Description: General notification system for all users

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'User ID who should receive this notification',
  type ENUM('password_reset_request', 'user_verification', 'system_alert', 'region_request', 'user_activity', 'security_alert') NOT NULL COMMENT 'Notification type',
  title VARCHAR(255) NOT NULL COMMENT 'Notification title',
  message TEXT NOT NULL COMMENT 'Notification message',
  data JSON NULL COMMENT 'Additional data related to the notification',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium' COMMENT 'Notification priority',
  is_read BOOLEAN DEFAULT FALSE COMMENT 'Whether notification has been read',
  read_at DATETIME NULL COMMENT 'When notification was read',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When notification was created',
  expires_at DATETIME NULL COMMENT 'When notification expires (optional)',
  action_url VARCHAR(500) NULL COMMENT 'URL for action button (optional)',
  action_label VARCHAR(100) NULL COMMENT 'Label for action button (optional)',
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  INDEX idx_priority (priority),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User notifications';

-- Show created table
DESCRIBE notifications;
