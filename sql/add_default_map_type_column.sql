-- Add default_map_type column to user_map_preferences table
-- Run this on your company's server if the column doesn't exist

-- Check if column exists (for MySQL 5.7+)
-- If you get an error about column already existing, that means it's already there

ALTER TABLE user_map_preferences
ADD COLUMN default_map_type VARCHAR(50) DEFAULT 'satellite'
AFTER user_id;

-- Update any existing NULL values to 'satellite'
UPDATE user_map_preferences
SET default_map_type = 'satellite'
WHERE default_map_type IS NULL;

-- Verify the column was added
DESCRIBE user_map_preferences;

-- Show current preferences
SELECT id, user_id, default_map_type, default_zoom, default_center
FROM user_map_preferences;
