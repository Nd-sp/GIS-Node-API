-- ========================================
-- Add Missing Fields to Users Table
-- ========================================

USE opticonnectgis_db;

-- Add gender field
ALTER TABLE users
ADD COLUMN IF NOT EXISTS gender ENUM('Male', 'Female', 'Other') DEFAULT 'Other' AFTER full_name;

-- Add address fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS street VARCHAR(255) AFTER department,
ADD COLUMN IF NOT EXISTS city VARCHAR(100) AFTER street,
ADD COLUMN IF NOT EXISTS state VARCHAR(100) AFTER city,
ADD COLUMN IF NOT EXISTS pincode VARCHAR(20) AFTER state;

-- Verify changes
SELECT 'Users table updated successfully!' as Status;

-- Show updated structure
DESCRIBE users;
