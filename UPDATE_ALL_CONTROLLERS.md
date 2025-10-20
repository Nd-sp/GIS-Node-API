# Update All GIS Controllers for User Filtering

## Issue
Admin/Manager cannot filter GIS data by specific users in the GIS Data Hub page.

## Fix Required
Update the `getAll` methods in these controllers to support `filter` and `userId` query parameters:

1. ✅ `distanceMeasurementController.js` - DONE
2. ⏳ `polygonDrawingController.js` 
3. ⏳ `circleDrawingController.js`
4. ⏳ `sectorRFController.js`
5. ⏳ `elevationProfileController.js`

## Pattern to Apply

Replace this:
```javascript
const getAllX = async (req, res) => {
  try {
    const userId = req.user.id;
    const { regionId } = req.query;

    let query = 'SELECT * FROM table_name WHERE user_id = ?';
    const params = [userId];
```

With this:
```javascript
const getAllX = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;
    const { regionId, filter, userId: filterUserId } = req.query;

    let query = 'SELECT t.*, u.username FROM table_name t LEFT JOIN users u ON t.user_id = u.id WHERE ';
    const params = [];

    // Handle user filtering based on role and filter parameter
    if ((currentUserRole === 'Admin' || currentUserRole === 'Manager') && filter) {
      if (filter === 'all') {
        // Return ALL users' data
        query += '1=1';
      } else if (filter === 'user' && filterUserId) {
        // Return specific user's data
        query += 't.user_id = ?';
        params.push(parseInt(filterUserId));
      } else {
        // Default to current user
        query += 't.user_id = ?';
        params.push(currentUserId);
      }
    } else {
      // Regular users see only their own data
      query += 't.user_id = ?';
      params.push(currentUserId);
    }

    if (regionId) {
      query += ' AND t.region_id = ?';
      params.push(regionId);
    }

    query += ' ORDER BY t.created_at DESC';

    const [results] = await pool.query(query, params);
```

## Testing
After updating all controllers, test with:
1. Login as Admin
2. Go to GIS Data Hub
3. Select "My Data Only" - should see only admin's data
4. Select "All Users" - should see all users' data
5. Select specific user (e.g., HIMIL CHAUHAN) - should see only that user's data

The stats counts should update correctly based on the filter selection.
