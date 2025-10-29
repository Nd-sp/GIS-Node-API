-- Migration: Add email verification fields to users table
-- Date: 2025-01-27
-- Description: Add is_email_verified and email_verified_at columns for email verification feature

-- Check if column already exists before adding
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE COMMENT 'Whether user email has been verified',
ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL COMMENT 'Timestamp when email was verified',
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255) NULL COMMENT 'Token for email verification',
ADD COLUMN IF NOT EXISTS verification_token_expires DATETIME NULL COMMENT 'Expiration time for verification token';

-- For existing users, mark admin as verified (optional - adjust as needed)
UPDATE users
SET is_email_verified = TRUE,
    email_verified_at = NOW()
WHERE role = 'Admin' AND is_email_verified = FALSE;

-- Show updated schema
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnectgis_db'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('is_email_verified', 'email_verified_at', 'verification_token', 'verification_token_expires')
ORDER BY ORDINAL_POSITION;
