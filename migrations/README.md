# Database Migrations

This folder contains database migration scripts to update the OptiConnect database schema.

## Global Search Feature Migration

This migration adds the necessary columns to support the Global Search feature.

### What it does:

1. **distance_measurements table:**
   - Adds `measurement_name`, `total_distance`, `points` columns

2. **polygon_drawings table:**
   - Adds `polygon_name`, `vertices`, `area`, `perimeter` columns

3. **circle_drawings table:**
   - Adds `circle_name`, `center`, `radius`, `area` columns

4. **sector_rf_data table:**
   - Adds `sector_name`, `center`, `radius`, `start_angle`, `end_angle` columns

5. **elevation_profiles table:**
   - Creates new table for elevation profile data

6. **search_history table:**
   - Creates new table for logging search queries

### How to run:

#### Option 1: Using Node.js (Recommended)

```bash
cd C:\Users\hkcha\OneDrive\Desktop\New folder\OptiConnect_Backend\migrations
node runMigration.js
```

#### Option 2: Using MySQL Client

```bash
mysql -u root -p opticonnectgis_db < add_search_columns.sql
```

Or using MySQL Workbench:
1. Open MySQL Workbench
2. Connect to your database
3. Open `add_search_columns.sql`
4. Execute the script

### Safety Notes:

✅ **This migration is safe to run**
- Only adds new columns (doesn't remove or modify existing ones)
- Uses `ADD COLUMN IF NOT EXISTS` to prevent errors if already run
- Existing data is preserved
- Backward compatible with existing code

⚠️ **Already run the migration?**
- Safe to run again - will skip columns that already exist
- No data will be lost

### Verify Migration:

After running, verify the columns exist:

```sql
-- Check distance_measurements
DESCRIBE distance_measurements;

-- Check polygon_drawings
DESCRIBE polygon_drawings;

-- Check circle_drawings
DESCRIBE circle_drawings;

-- Check sector_rf_data
DESCRIBE sector_rf_data;

-- Check new tables
SHOW TABLES LIKE 'elevation_profiles';
SHOW TABLES LIKE 'search_history';
```

### Rollback (if needed):

If you need to remove the added columns:

```sql
-- WARNING: This will remove the columns and their data!

ALTER TABLE distance_measurements
  DROP COLUMN IF EXISTS measurement_name,
  DROP COLUMN IF EXISTS total_distance,
  DROP COLUMN IF EXISTS points;

ALTER TABLE polygon_drawings
  DROP COLUMN IF EXISTS polygon_name,
  DROP COLUMN IF EXISTS vertices,
  DROP COLUMN IF EXISTS area,
  DROP COLUMN IF EXISTS perimeter;

ALTER TABLE circle_drawings
  DROP COLUMN IF EXISTS circle_name,
  DROP COLUMN IF EXISTS center,
  DROP COLUMN IF EXISTS radius,
  DROP COLUMN IF EXISTS area;

ALTER TABLE sector_rf_data
  DROP COLUMN IF EXISTS sector_name,
  DROP COLUMN IF EXISTS center,
  DROP COLUMN IF EXISTS radius,
  DROP COLUMN IF EXISTS start_angle,
  DROP COLUMN IF EXISTS end_angle;

DROP TABLE IF EXISTS elevation_profiles;
DROP TABLE IF EXISTS search_history;
```

### Troubleshooting:

**Error: "Access denied for user"**
- Make sure you're using the correct MySQL credentials
- Check that the user has ALTER TABLE permissions

**Error: "Table doesn't exist"**
- Make sure you're running the script on the correct database
- Check if the base tables were created during initial setup

**Error: "Duplicate column name"**
- This is normal if the migration was already run
- The script will skip duplicate columns automatically

### Need Help?

Check the application logs for any database-related errors:
```bash
cd C:\Users\hkcha\OneDrive\Desktop\New folder\OptiConnect_Backend
npm start
```

Look for errors in the console output related to database schema.
