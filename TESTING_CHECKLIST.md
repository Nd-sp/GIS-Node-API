# 🧪 KML Import & Map API Testing Checklist

## ✅ Data Verification (COMPLETED)

### Import Summary:
- ✅ **Total Records**: 2,111 infrastructure items
- ✅ **POP Locations**: 984 (item_type = 'POP')
- ✅ **SubPOP Locations**: 1,127 (item_type = 'SubPOP')
- ✅ **Region Assignment**: 95.7% (2,020 items)
- ✅ **No Duplicates**: All unique_id values are unique
- ✅ **Status Distribution**: Active (1,131) + RFS (980)

### Top 5 Regions:
1. Gujarat: 1,276 items
2. Maharashtra: 329 items
3. Rajasthan: 138 items
4. Uttar Pradesh: 103 items
5. Karnataka: 95 items

---

## 🧪 API Testing Checklist

### 1. **Test Map View API (Viewport Filtering)**

#### Test Case 1.1: Gujarat Region
```bash
curl -X GET "http://localhost:82/api/infrastructure/map-view?north=24.7&south=20.0&east=74.5&west=68.0&zoom=8" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Status: 200 OK
- Response should contain ~500-1000 items (limited by zoom level)
- Each item should have: `id`, `item_type`, `item_name`, `latitude`, `longitude`, `status`, `region_name`
- `item_type` should be either 'POP' or 'SubPOP'

---

#### Test Case 1.2: Mumbai Area (High Zoom)
```bash
curl -X GET "http://localhost:82/api/infrastructure/map-view?north=19.3&south=18.9&east=72.95&west=72.75&zoom=12" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Should return fewer items (only in Mumbai viewport)
- Faster response time
- All coordinates should be within the specified bounds

---

### 2. **Test Clustering API (Low Zoom)**

#### Test Case 2.1: Country-Level View
```bash
curl -X GET "http://localhost:82/api/infrastructure/clusters?north=35&south=8&east=97&west=68&zoom=6" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Status: 200 OK
- Response should contain clusters (not individual items)
- Each cluster should have: `type: 'cluster'`, `latitude`, `longitude`, `count`, `pop_count`, `subpop_count`
- Total clusters should be ~50-200 (much less than 2,111 items)

---

#### Test Case 2.2: State-Level View (Gujarat)
```bash
curl -X GET "http://localhost:82/api/infrastructure/clusters?north=24.7&south=20.0&east=74.5&west=68.0&zoom=9" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- More clusters than country view
- Clusters should be centered in Gujarat
- `pop_count` + `subpop_count` should equal `count`

---

### 3. **Test Paginated List API**

#### Test Case 3.1: Get First Page of POP Locations
```bash
curl -X GET "http://localhost:82/api/infrastructure?page=1&limit=50&item_type=POP" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Status: 200 OK
- Response should contain:
  - `items`: array of 50 POP items
  - `pagination`: { page: 1, limit: 50, total: 984, totalPages: 20, hasNextPage: true, hasPrevPage: false }

---

#### Test Case 3.2: Get Second Page
```bash
curl -X GET "http://localhost:82/api/infrastructure?page=2&limit=50&item_type=POP" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Different 50 items
- `pagination.hasPrevPage: true`

---

#### Test Case 3.3: Filter by Region
```bash
curl -X GET "http://localhost:82/api/infrastructure?page=1&limit=100&regionId=6" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Only items from the specified region
- Total count matches region's infrastructure count

---

### 4. **Test Access Control**

#### Test Case 4.1: Admin User (See All Data)
```bash
# Login as admin
curl -X POST "http://localhost:82/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin_password"}'

# Use admin token to get all data
curl -X GET "http://localhost:82/api/infrastructure/stats" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected Result:**
- Total should be 2,111+ (including KML + any manual entries)
- Can see all regions

---

#### Test Case 4.2: Regular User (See Assigned Region Only)
```bash
# Login as regular user
curl -X POST "http://localhost:82/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "user_password"}'

# Use user token
curl -X GET "http://localhost:82/api/infrastructure/stats" \
  -H "Authorization: Bearer USER_TOKEN"
```

**Expected Result:**
- Total should be less (only assigned regions)
- Cannot see data from other regions

---

### 5. **Test Icon Differentiation**

#### Test Case 5.1: Check Item Types
```bash
curl -X GET "http://localhost:82/api/infrastructure?limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Each item should have `item_type` field
- Values should be either 'POP' or 'SubPOP'
- Frontend can use this to show different icons:
  - `item_type === 'POP'` → Blue icon 🔵
  - `item_type === 'SubPOP'` → Red icon 🔴

---

### 6. **Performance Testing**

#### Test Case 6.1: Query Speed (With Indexes)
```bash
# Time the request
time curl -X GET "http://localhost:82/api/infrastructure/map-view?north=35&south=8&east=97&west=68&zoom=8" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Response time < 500ms
- No timeout errors
- Smooth pagination

---

#### Test Case 6.2: Large Dataset Query
```bash
curl -X GET "http://localhost:82/api/infrastructure?page=1&limit=1000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Result:**
- Response time < 2 seconds
- All 1000 items returned
- Pagination metadata correct

---

## 🎨 Frontend Testing Checklist

### 1. **Map Rendering Test**
- [ ] Load map page
- [ ] Verify no browser crash/hang
- [ ] Check memory usage stays < 200MB
- [ ] Smooth pan/zoom at 60 FPS

### 2. **Icon Differentiation Test**
- [ ] POP locations show blue icons
- [ ] SubPOP locations show red icons
- [ ] Icons are clearly distinguishable
- [ ] Clicking icon shows correct item details

### 3. **Clustering Test**
- [ ] At zoom level 1-10: See cluster circles with counts
- [ ] At zoom level 11-14: Mix of clusters + individual markers
- [ ] At zoom level 15+: Only individual markers
- [ ] Clicking cluster zooms into that area

### 4. **Lazy Loading Test**
- [ ] Pan to new area: New markers load automatically
- [ ] Old markers outside viewport are removed
- [ ] Loading indicator shows during fetch
- [ ] No duplicate markers

### 5. **Region Filtering Test**
- [ ] Select region from dropdown
- [ ] Only markers from that region appear
- [ ] Map centers on selected region
- [ ] Count matches expected

### 6. **User Role Test**
- [ ] Admin sees all 2,111 infrastructure items
- [ ] Regular user sees only assigned region items
- [ ] Manager can toggle between all/specific regions

---

## 🔧 Database Verification Scripts

### Run These Scripts to Verify Data:

```bash
# 1. Check for duplicates
node scripts/test-kml-data.js

# 2. Verify import completeness
node scripts/verify-kml-import.js

# 3. Remove duplicates if found
node scripts/remove-duplicates.js
```

---

## ✅ Success Criteria

### Data Import:
- ✅ 2,111 total items (984 POP + 1,127 SubPOP)
- ✅ No duplicate unique_id values
- ✅ 95%+ items assigned to regions
- ✅ Valid coordinates (lat: -90 to 90, lng: -180 to 180)

### API Performance:
- ✅ Map view API responds in < 500ms
- ✅ Clustering API responds in < 500ms
- ✅ Pagination works correctly
- ✅ Role-based filtering works

### Frontend Performance:
- ✅ Map loads without crash
- ✅ Smooth 60 FPS pan/zoom
- ✅ Memory usage < 200MB
- ✅ Can handle 10,000+ markers with clustering

---

## 🐛 Common Issues & Solutions

### Issue 1: "Browser crashes when loading map"
**Solution**: Verify clustering is enabled on frontend. Use `/api/infrastructure/clusters` for zoom < 15.

### Issue 2: "Duplicate markers appearing"
**Solution**: Run `node scripts/remove-duplicates.js` to clean database.

### Issue 3: "User sees all data instead of region data"
**Solution**: Check `user_regions` table has correct assignments.

### Issue 4: "Slow map loading"
**Solution**: Verify database indexes created: `node scripts/add-coordinate-indexes.js`

### Issue 5: "Cannot differentiate POP vs SubPOP"
**Solution**: Use `item.item_type === 'POP'` or `item.item_type === 'SubPOP'` to select icons.

---

## 📞 Testing Endpoints Summary

| Endpoint | Purpose | Zoom Level |
|----------|---------|------------|
| `/api/infrastructure/map-view` | Viewport filtering | 15+ (high zoom) |
| `/api/infrastructure/clusters` | Grid clustering | 1-14 (low zoom) |
| `/api/infrastructure` | Paginated list | N/A (table view) |
| `/api/infrastructure/stats` | Statistics | N/A (dashboard) |
| `/api/infrastructure/:id` | Single item details | N/A (detail view) |

---

## 🎯 Final Checklist

- [x] KML data imported (2,111 items)
- [x] No duplicates in database
- [x] Database indexes created
- [x] API endpoints implemented
- [ ] Frontend marker clustering implemented
- [ ] Frontend icon differentiation implemented
- [ ] Frontend lazy loading implemented
- [ ] Performance testing completed
- [ ] User acceptance testing completed

---

**Next Steps:**
1. Test APIs using Postman or Thunder Client
2. Implement frontend clustering (Leaflet.markercluster)
3. Add different icons for POP (blue) and SubPOP (red)
4. Test with real users
5. Monitor performance in production
