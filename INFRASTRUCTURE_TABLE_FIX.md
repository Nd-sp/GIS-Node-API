# Infrastructure Table Name Fix

## Issue
```
Error: Table 'opticonnectgis_db.infrastructure' doesn't exist
GET /api/datahub/all 500
```

## Root Cause
The `dataHubController.js` was querying the wrong table name:
- **Incorrect:** `infrastructure`
- **Correct:** `infrastructure_items`

## Fix Applied
Updated `src/controllers/dataHubController.js` line 59:

**Before:**
```javascript
const [infrastructures] = await pool.query(
  `SELECT i.*, u.username as user_name FROM infrastructure i 
   LEFT JOIN users u ON i.user_id = u.id 
   WHERE ${whereClause} ORDER BY i.created_on DESC`,
  whereParams
);
```

**After:**
```javascript
const [infrastructures] = await pool.query(
  `SELECT i.*, u.username as user_name FROM infrastructure_items i 
   LEFT JOIN users u ON i.user_id = u.id 
   WHERE ${whereClause} ORDER BY i.created_at DESC`,
  whereParams
);
```

## Changes Made
1. Changed table name from `infrastructure` to `infrastructure_items`
2. Changed ORDER BY field from `created_on` to `created_at` (to match table schema)

## Status
✅ **Fixed!** The backend should now successfully fetch all data including infrastructure items.

## Testing
Refresh your frontend Data Hub page - it should now load without 500 errors!
