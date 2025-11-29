-- Migration: Add Two-Factor Authentication (2FA) Support
-- Date: 2025-01-14
-- Description: Adds 2FA columns to users table and creates mfa_tokens table

USE opticonnectgis_db;

-- ============================================================================
-- Step 1: Add 2FA columns to users table
-- ============================================================================

ALTER TABLE users
ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE COMMENT 'Whether 2FA is enabled for this user',
ADD COLUMN mfa_method ENUM('email', 'totp', 'sms') DEFAULT 'email' COMMENT 'Method used for 2FA (email by default)',
ADD COLUMN mfa_secret VARCHAR(255) NULL COMMENT 'Secret key for TOTP (future use)',
ADD COLUMN mfa_enabled_at DATETIME NULL COMMENT 'When 2FA was enabled',
ADD COLUMN mfa_backup_codes TEXT NULL COMMENT 'JSON array of backup codes (future use)',
ADD INDEX idx_mfa_enabled (mfa_enabled);

-- ============================================================================
-- Step 2: Create mfa_tokens table for storing verification codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS mfa_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(6) NOT NULL COMMENT '6-digit verification code',
  expires_at DATETIME NOT NULL COMMENT 'When the token expires (10 minutes from creation)',
  is_used BOOLEAN DEFAULT FALSE COMMENT 'Whether the token has been used',
  attempts INT DEFAULT 0 COMMENT 'Number of verification attempts',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL COMMENT 'When the token was successfully used',
  ip_address VARCHAR(45) NULL COMMENT 'IP address that requested the token',
  user_agent TEXT NULL COMMENT 'Browser/device information',

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_user_token (user_id, token),
  INDEX idx_expires (expires_at),
  INDEX idx_user_active (user_id, is_used, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Stores 2FA verification codes sent via email';

-- ============================================================================
-- Step 3: Create cleanup event for expired tokens (runs every hour)
-- ============================================================================

-- Enable event scheduler if not already enabled
SET GLOBAL event_scheduler = ON;

-- Create event to delete expired tokens older than 24 hours
DROP EVENT IF EXISTS cleanup_expired_mfa_tokens;

CREATE EVENT cleanup_expired_mfa_tokens
ON SCHEDULE EVERY 1 HOUR
COMMENT 'Delete expired 2FA tokens older than 24 hours'
DO
  DELETE FROM mfa_tokens
  WHERE expires_at < DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- ============================================================================
-- Step 4: Add audit logging for 2FA events
-- ============================================================================

-- Add new action types to audit_logs if they don't exist
-- (Assuming audit_logs.action is TEXT or VARCHAR with sufficient length)
-- No schema change needed, just documenting new action types:
-- - '2FA_ENABLED'
-- - '2FA_DISABLED'
-- - '2FA_CODE_SENT'
-- - '2FA_CODE_VERIFIED'
-- - '2FA_CODE_FAILED'

-- ============================================================================
-- Migration Complete
-- ============================================================================

SELECT '✅ 2FA Support Migration Completed Successfully!' as status;
SELECT
  COUNT(*) as total_users,
  SUM(CASE WHEN mfa_enabled = TRUE THEN 1 ELSE 0 END) as users_with_2fa_enabled
FROM users;
