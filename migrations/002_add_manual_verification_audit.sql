-- Migration: Add manual verification audit trail
-- Date: 2025-01-27
-- Description: Add fields to track manual email verification by admins

-- Add audit trail columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified_by INT NULL COMMENT 'User ID of admin who manually verified email',
ADD COLUMN IF NOT EXISTS manual_verification BOOLEAN DEFAULT FALSE COMMENT 'Whether email was manually verified by admin',
ADD COLUMN IF NOT EXISTS last_verification_email_sent DATETIME NULL COMMENT 'Timestamp of last verification email sent';

-- Add foreign key constraint for email_verified_by
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS fk_email_verified_by
FOREIGN KEY (email_verified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Show updated schema
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'opticonnectgis_db'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME IN ('email_verified_by', 'manual_verification', 'last_verification_email_sent')
ORDER BY ORDINAL_POSITION;
