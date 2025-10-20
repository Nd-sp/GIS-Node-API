# Database and API Fixes

## Issues Fixed

### 1. ❌ Error: Unknown column 'u.name'
**File:** `src/controllers/elevationProfileController.js` (line 23)

**Problem:** The query was trying to select `u.name` but the users table has a `username` column instead.

**Fix:**
```javascript
// BEFORE
SELECT ep.*, u.name as username, u.email as user_email

// AFTER
SELECT ep.*, u.username as username, u.email as user_email
```

---

### 2. ❌ Error: utc_timestamp → UTC_TIMESTAMP()
**File:** `src/config/database.js` (line 29)

**Problem:** The database query was using lowercase `utc_timestamp` as a column alias, which conflicted with MySQL function names.

**Fix:**
```javascript
// BEFORE
const [timeResult] = await connection.query('SELECT NOW() as server_time, UTC_TIMESTAMP() as utc_timestamp');
console.log('🕐 UTC Time:', timeResult[0].utc_timestamp);

// AFTER
const [timeResult] = await connection.query('SELECT NOW() as server_time, UTC_TIMESTAMP() as utc_time');
console.log('🕐 UTC Time:', timeResult[0].utc_time);
```

---

### 3. ❌ Route /api/data-hub/all not found

**Problem:** Frontend was calling `/api/data-hub/all` but:
- Backend routes were set up as `/api/datahub/` (no hyphen)
- The `/all` endpoint didn't exist

**Fixes Applied:**

#### Backend: Added missing endpoint
**File:** `src/controllers/dataHubController.js`

Added new `getAllData` function that fetches all user data from multiple tables:
- Distance measurements
- Polygon drawings
- Circle drawings
- Elevation profiles
- Infrastructure
- Sector RF

```javascript
const getAllData = async (req, res) => {
  try {
    const userId = req.user.id;
    const allData = [];

    // Fetch all measurement types for this user
    const [distances] = await pool.query(
      'SELECT * FROM distance_measurements WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    distances.forEach(d => allData.push({ ...d, type: 'Distance' }));

    // ... (similar queries for other types)

    res.json({ success: true, data: allData, count: allData.length });
  } catch (error) {
    console.error('Get all data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get data' });
  }
};
```

#### Backend: Added route
**File:** `src/routes/dataHub.routes.js`

```javascript
router.get('/all', getAllData);
```

#### Frontend: Fixed API path
**File:** `OptiConnect_Frontend/src/services/dataHubService.ts`

Changed all `data-hub` references to `datahub` to match backend:
```typescript
// BEFORE
fetch(`${API_BASE_URL}/data-hub/all`)
fetch(`${API_BASE_URL}/data-hub/delete`)
fetch(`${API_BASE_URL}/data-hub/export/${format}`)

// AFTER
fetch(`${API_BASE_URL}/datahub/all`)
fetch(`${API_BASE_URL}/datahub/delete`)
fetch(`${API_BASE_URL}/datahub/export/${format}`)
```

---

## Testing

### Restart Backend Server
```powershell
# Kill any existing processes
taskkill /F /IM node.exe

# Start backend
cd "C:\Users\hkcha\OneDrive\Desktop\New folder\OptiConnect_Backend"
npm start
```

### Verify Server Status
Look for these messages in the console:
```
✅ MySQL Database Connected Successfully!
🕐 MySQL Timezone: +00:00
🕐 Server Time: 2025-10-14 11:04:16
🕐 UTC Time: 2025-10-14 11:04:16
✅ All routes loaded successfully
🚀 Server is ready to accept requests!
```

### Test Endpoints
```bash
# Health check
curl http://localhost:5005/api/health

# Test datahub/all (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5005/api/datahub/all
```

---

## Status
✅ **All fixes applied successfully!**

- Database column name fixed: `u.name` → `u.username`
- SQL function alias fixed: `utc_timestamp` → `utc_time`
- Missing route added: `/api/datahub/all`
- Frontend API paths corrected: `data-hub` → `datahub`

The backend should now start without errors and the Data Hub feature should work correctly.
