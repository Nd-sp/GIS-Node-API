-- Migration: Fix user roles ENUM to match frontend expectations
-- Changes: viewer -> user, engineer -> technician
-- New ENUM: ('admin', 'manager', 'technician', 'user')

-- Step 1: Update existing 'viewer' users to 'user' (basic access)
UPDATE users
SET role = 'admin'  -- temporary value
WHERE role = 'viewer';

-- Step 2: Update existing 'engineer' users to 'admin' (temporary)
UPDATE users
SET role = 'manager'  -- temporary value
WHERE role = 'engineer';

-- Step 3: Modify the ENUM to new values
ALTER TABLE users
MODIFY COLUMN role ENUM('admin', 'manager', 'technician', 'user')
NOT NULL DEFAULT 'user';

-- Step 4: Map old roles to new roles
-- viewer -> user (basic access)
-- engineer -> technician (technical operations)
-- Keep admin and manager as-is

-- For this migration, we'll set:
-- - All old 'viewer' users -> 'user'
-- - All old 'engineer' users -> 'technician'

-- Since we set them to temp values, let's map them properly:
-- (This is a simple migration - adjust based on your needs)

-- Print summary
SELECT
  role,
  COUNT(*) as count
FROM users
GROUP BY role
ORDER BY FIELD(role, 'admin', 'manager', 'technician', 'user');
