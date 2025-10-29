-- Migration: Create password_reset_requests table
-- Date: 2025-01-28
-- Description: Table to store user password reset requests for admin approval

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL COMMENT 'User ID if found, NULL if user not found',
  username_or_email VARCHAR(255) NOT NULL COMMENT 'Username or email provided by user',
  reason TEXT NULL COMMENT 'Optional reason provided by user',
  status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending' COMMENT 'Request status',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'When request was submitted',
  reviewed_by INT NULL COMMENT 'Admin user ID who reviewed the request',
  reviewed_at DATETIME NULL COMMENT 'When request was reviewed',
  review_note TEXT NULL COMMENT 'Admin notes about the review',
  new_password VARCHAR(255) NULL COMMENT 'Encrypted new password set by admin',
  ip_address VARCHAR(45) NULL COMMENT 'IP address of the requester',
  user_agent TEXT NULL COMMENT 'User agent of the requester',
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_requested_at (requested_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Password reset requests from users';

-- Show created table
DESCRIBE password_reset_requests;
