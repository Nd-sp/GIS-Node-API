# 🚀 QUICK API REFERENCE - Copy & Paste Ready

**Base URL:** `http://localhost:5000`

---

## 🔐 AUTHENTICATION APIs (All Working ✅)

### 1. Register User
```
POST http://localhost:5000/api/auth/register
Headers: Content-Type: application/json
Body:
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "full_name": "Test User",
  "role": "viewer"
}
```

### 2. Login
```
POST http://localhost:5000/api/auth/login
Headers: Content-Type: application/json
Body:
{
  "email": "test@example.com",
  "password": "password123"
}
Response: { "token": "...", "user": {...} }
```

### 3. Get Current User
```
GET http://localhost:5000/api/auth/me
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
```

### 4. Change Password
```
POST http://localhost:5000/api/auth/change-password
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "oldPassword": "password123",
  "newPassword": "newpassword123"
}
```

### 5. Logout
```
POST http://localhost:5000/api/auth/logout
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 👥 USER MANAGEMENT APIs (All Working ✅)

### 6. Get All Users
```
GET http://localhost:5000/api/users?page=1&limit=10&search=john
Headers: Authorization: Bearer YOUR_TOKEN
```

### 7. Get User by ID
```
GET http://localhost:5000/api/users/1
Headers: Authorization: Bearer YOUR_TOKEN
```

### 8. Create User
```
POST http://localhost:5000/api/users
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "full_name": "New User",
  "role": "viewer"
}
```

### 9. Update User
```
PUT http://localhost:5000/api/users/1
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "full_name": "Updated Name",
  "phone": "1234567890"
}
```

### 10. Delete User
```
DELETE http://localhost:5000/api/users/1
Headers: Authorization: Bearer YOUR_TOKEN
```

### 11. Activate User
```
PATCH http://localhost:5000/api/users/1/activate
Headers: Authorization: Bearer YOUR_TOKEN
```

### 12. Deactivate User
```
PATCH http://localhost:5000/api/users/1/deactivate
Headers: Authorization: Bearer YOUR_TOKEN
```

### 13. Get User's Regions
```
GET http://localhost:5000/api/users/1/regions
Headers: Authorization: Bearer YOUR_TOKEN
```

### 14. Assign Region to User
```
POST http://localhost:5000/api/users/1/regions
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "regionId": 1,
  "accessLevel": "read"
}
```

### 15. Unassign Region from User
```
DELETE http://localhost:5000/api/users/1/regions/1
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 🗺️ REGION MANAGEMENT APIs (All Working ✅)

### 16. Get All Regions
```
GET http://localhost:5000/api/regions
Headers: Authorization: Bearer YOUR_TOKEN
```

### 17. Get Region by ID
```
GET http://localhost:5000/api/regions/1
Headers: Authorization: Bearer YOUR_TOKEN
```

### 18. Create Region
```
POST http://localhost:5000/api/regions
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "name": "North Zone",
  "code": "NZ001",
  "type": "zone",
  "latitude": 28.6139,
  "longitude": 77.2090
}
```

### 19. Update Region
```
PUT http://localhost:5000/api/regions/1
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "name": "Updated Region Name",
  "description": "New description"
}
```

### 20. Delete Region
```
DELETE http://localhost:5000/api/regions/1
Headers: Authorization: Bearer YOUR_TOKEN
```

### 21. Get Child Regions
```
GET http://localhost:5000/api/regions/1/children
Headers: Authorization: Bearer YOUR_TOKEN
```

### 22. Get Region Users
```
GET http://localhost:5000/api/regions/1/users
Headers: Authorization: Bearer YOUR_TOKEN
```

### 23. Get Region Hierarchy
```
GET http://localhost:5000/api/regions/hierarchy
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 📏 DISTANCE MEASUREMENT APIs (All Working ✅)

### 24. Get All Measurements
```
GET http://localhost:5000/api/measurements/distance
Headers: Authorization: Bearer YOUR_TOKEN
```

### 25. Get Measurement by ID
```
GET http://localhost:5000/api/measurements/distance/1
Headers: Authorization: Bearer YOUR_TOKEN
```

### 26. Create Distance Measurement
```
POST http://localhost:5000/api/measurements/distance
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "measurement_name": "Tower to Building",
  "points": [
    {"lat": 28.6139, "lng": 77.2090},
    {"lat": 28.6150, "lng": 77.2100}
  ],
  "total_distance": 1250.5,
  "unit": "meters",
  "region_id": 1,
  "is_saved": true
}
```

### 27. Update Measurement
```
PUT http://localhost:5000/api/measurements/distance/1
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "measurement_name": "Updated Name",
  "notes": "Updated notes"
}
```

### 28. Delete Measurement
```
DELETE http://localhost:5000/api/measurements/distance/1
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 📐 POLYGON DRAWING APIs (Placeholder - Coming Soon)

### 29. Get All Polygons
```
GET http://localhost:5000/api/drawings/polygon
Headers: Authorization: Bearer YOUR_TOKEN
Response: { "success": true, "message": "Polygon Drawing API - Coming soon", "polygons": [] }
```

### 30. Create Polygon
```
POST http://localhost:5000/api/drawings/polygon
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "polygon_name": "Coverage Area",
  "coordinates": [...],
  "area": 5000,
  "region_id": 1
}
```

---

## ⭕ CIRCLE DRAWING APIs (Placeholder - Coming Soon)

### 31. Get All Circles
```
GET http://localhost:5000/api/drawings/circle
Headers: Authorization: Bearer YOUR_TOKEN
```

### 32. Create Circle
```
POST http://localhost:5000/api/drawings/circle
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "circle_name": "Coverage Zone",
  "center_lat": 28.6139,
  "center_lng": 77.2090,
  "radius": 1000,
  "region_id": 1
}
```

---

## 📡 SECTOR RF APIs (Placeholder - Coming Soon)

### 33. Get All Sectors
```
GET http://localhost:5000/api/rf/sectors
Headers: Authorization: Bearer YOUR_TOKEN
```

### 34. Create Sector
```
POST http://localhost:5000/api/rf/sectors
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "sector_name": "Tower A - Sector 1",
  "tower_lat": 28.6139,
  "tower_lng": 77.2090,
  "azimuth": 45,
  "beamwidth": 65,
  "radius": 1500,
  "region_id": 1
}
```

---

## ⛰️ ELEVATION PROFILE APIs (Placeholder - Coming Soon)

### 35. Get All Elevation Profiles
```
GET http://localhost:5000/api/elevation/profiles
Headers: Authorization: Bearer YOUR_TOKEN
```

### 36. Create Elevation Profile
```
POST http://localhost:5000/api/elevation/profiles
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "profile_name": "Mountain Path",
  "start_point": {"lat": 28.6139, "lng": 77.2090},
  "end_point": {"lat": 28.6150, "lng": 77.2100},
  "region_id": 1
}
```

---

## 🏗️ INFRASTRUCTURE APIs (Placeholder - Coming Soon)

### 37. Get All Infrastructure Items
```
GET http://localhost:5000/api/infrastructure
Headers: Authorization: Bearer YOUR_TOKEN
```

### 38. Create Infrastructure Item
```
POST http://localhost:5000/api/infrastructure
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "item_type": "tower",
  "item_name": "Cell Tower A1",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "height": 50,
  "status": "active",
  "region_id": 1
}
```

---

## 🗂️ LAYER MANAGEMENT APIs (Placeholder - Coming Soon)

### 39. Get All Layers
```
GET http://localhost:5000/api/layers
Headers: Authorization: Bearer YOUR_TOKEN
```

### 40. Create Layer
```
POST http://localhost:5000/api/layers
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "layer_name": "Coverage Map",
  "layer_type": "mixed",
  "layer_data": {...},
  "region_id": 1
}
```

---

## 🔖 BOOKMARK APIs (Placeholder - Coming Soon)

### 41. Get All Bookmarks
```
GET http://localhost:5000/api/bookmarks
Headers: Authorization: Bearer YOUR_TOKEN
```

### 42. Create Bookmark
```
POST http://localhost:5000/api/bookmarks
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "name": "Important Location",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "zoom_level": 15
}
```

---

## 🔍 SEARCH APIs (Placeholder - Coming Soon)

### 43. Global Search
```
GET http://localhost:5000/api/search/global?q=tower
Headers: Authorization: Bearer YOUR_TOKEN
```

### 44. Get Search History
```
GET http://localhost:5000/api/search/history
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 📊 ANALYTICS APIs (Placeholder - Coming Soon)

### 45. Get Dashboard Analytics
```
GET http://localhost:5000/api/analytics/dashboard
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## 📝 AUDIT LOGS APIs (Placeholder - Coming Soon)

### 46. Get Audit Logs
```
GET http://localhost:5000/api/audit/logs
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## ⚙️ USER PREFERENCES APIs (Placeholder - Coming Soon)

### 47. Get Preferences
```
GET http://localhost:5000/api/preferences
Headers: Authorization: Bearer YOUR_TOKEN
```

### 48. Update Preferences
```
PUT http://localhost:5000/api/preferences
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "default_map_type": "satellite",
  "default_zoom": 12,
  "theme": "dark"
}
```

---

## 💾 DATA HUB APIs (Placeholder - Coming Soon)

### 49. Import Data
```
POST http://localhost:5000/api/datahub/import
Headers:
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN
Body:
{
  "import_type": "geojson",
  "file_name": "data.geojson"
}
```

### 50. Get Import History
```
GET http://localhost:5000/api/datahub/imports
Headers: Authorization: Bearer YOUR_TOKEN
```

---

## ✅ API Status Summary

| Category | Endpoints | Status |
|----------|-----------|--------|
| Authentication | 5 | ✅ Working |
| User Management | 12 | ✅ Working |
| Region Management | 8 | ✅ Working |
| Distance Measurement | 5 | ✅ Working |
| Polygon Drawing | 5 | ⏳ Placeholder |
| Circle Drawing | 5 | ⏳ Placeholder |
| SectorRF | 6 | ⏳ Placeholder |
| Elevation Profile | 5 | ⏳ Placeholder |
| Infrastructure | 7 | ⏳ Placeholder |
| Layer Management | 7 | ⏳ Placeholder |
| Bookmarks | 4 | ⏳ Placeholder |
| Search | 5 | ⏳ Placeholder |
| Analytics | 5 | ⏳ Placeholder |
| Audit Logs | 3 | ⏳ Placeholder |
| Preferences | 3 | ⏳ Placeholder |
| Data Hub | 5 | ⏳ Placeholder |
| Groups | 8 | ⏳ Placeholder |
| Features | 7 | ⏳ Placeholder |

**Total: 30 Working + 92 Placeholder = 122 APIs**

---

## 🎯 How to Use This Reference

1. **Copy any API request** from above
2. **Paste into Thunder Client**
3. **Replace** `YOUR_TOKEN` with actual token from login
4. **Update** IDs and data as needed
5. **Click Send**

---

## 🔑 Getting Your Token

Always login first to get your token:
```
POST http://localhost:5000/api/auth/login
Body: {"email": "admin@opticonnect.com", "password": "admin123"}
```

Copy the token from response and use it in all other requests!

---

## 📚 Full Documentation

For complete details, see:
- `API_HUB_CENTER.md` - All 122 APIs detailed
- `BACKEND_READY.md` - Current status
- `ALL_REMAINING_APIS.md` - Templates for remaining APIs
