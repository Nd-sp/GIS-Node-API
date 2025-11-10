-- =====================================================
-- FIX MySQL User Permissions for OptiConnect Backend
-- =====================================================
-- Run this script in MySQL Workbench or MySQL Command Line
-- This will fix the "Access Denied" and "ETIMEDOUT" errors

-- 1. Check existing users and their hosts
SELECT User, Host, plugin FROM mysql.user WHERE User = 'root';

-- 2. Create/Update root user with proper privileges for localhost
-- If root@localhost exists but has wrong password, this updates it
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Karma@1107';

-- 3. Create root user for 127.0.0.1 if it doesn't exist
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'Karma@1107';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;

-- 4. Grant all privileges to root@localhost
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;

-- 5. Apply changes
FLUSH PRIVILEGES;

-- 6. Verify the changes
SELECT User, Host, plugin FROM mysql.user WHERE User = 'root';

-- 7. Verify database exists
SHOW DATABASES LIKE 'opticonnectgis_db';

-- 8. If database doesn't exist, create it
CREATE DATABASE IF NOT EXISTS opticonnectgis_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- Success message
SELECT '✅ MySQL user permissions fixed! Try connecting again.' as Status;
