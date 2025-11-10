-- Add bearing column to elevation_profiles table
-- This stores the azimuth/bearing angle from Point A to Point B (for telecom antenna alignment)

ALTER TABLE elevation_profiles
ADD COLUMN bearing DECIMAL(6,2) DEFAULT NULL COMMENT 'Bearing/Azimuth angle from Point A to Point B (0-360 degrees)';

-- Verify the column was added
DESCRIBE elevation_profiles;
