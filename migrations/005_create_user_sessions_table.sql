-- ============================================================================
-- Migration: Create user_sessions table for tracking active user sessions
-- Description: Tracks currently active user sessions for real-time monitoring
-- Author: OptiConnect Backend Team
-- Date: 2025
-- ============================================================================

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_token VARCHAR(255) NOT NULL UNIQUE COMMENT 'Hashed JWT token for session identification',
  user_id INT NOT NULL COMMENT 'Reference to users table',
  ip_address VARCHAR(45) NULL COMMENT 'IP address of the session (supports IPv6)',
  device_info VARCHAR(500) NULL COMMENT 'Browser and device information',
  login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When the session was created',
  last_activity_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last activity timestamp',
  expires_at DATETIME NOT NULL COMMENT 'When the session expires',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether the session is currently active',
  logout_time DATETIME NULL COMMENT 'When the user logged out (NULL if still active)',
  logout_type ENUM('user', 'admin_forced', 'expired', 'system') NULL COMMENT 'How the session was terminated',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Foreign Keys
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Indexes for performance
  INDEX idx_user_sessions_user_id (user_id),
  INDEX idx_user_sessions_is_active (is_active),
  INDEX idx_user_sessions_expires_at (expires_at),
  INDEX idx_user_sessions_login_time (login_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks active user sessions for real-time monitoring and security';

-- ============================================================================
-- Rollback Instructions (if needed)
-- ============================================================================
-- To rollback this migration, run:
-- DROP TABLE IF EXISTS user_sessions;
-- ============================================================================

-- ============================================================================
-- Usage Notes
-- ============================================================================
-- 1. Run this migration on your company server
-- 2. This table will be populated when users log in
-- 3. Sessions are automatically tracked in authController
-- 4. Old/expired sessions should be cleaned up periodically
-- ============================================================================
