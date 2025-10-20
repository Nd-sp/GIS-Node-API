# ⚡ THUNDER CLIENT TESTING GUIDE

## Quick Start for Testing All 122 APIs

---

## 📋 PREREQUISITES

1. **Start the Backend Server:**

   ```bash
   cd C:\Users\hkcha\OneDrive\Desktop\OptiConnect\OptiConnect-Backend
   npm run dev
   ```

2. **Verify Server is Running:**

   - Open browser: `http://localhost:5000`
   - Should see: "🚀 PersonalGIS Backend API is running!"

3. **Install Thunder Client in VS Code:**
   - Go to Extensions (Ctrl+Shift+X)
   - Search "Thunder Client"
   - Install it
   - Click Thunder Client icon in sidebar

---

## 🚀 QUICK TEST SEQUENCE

### Step 1: Register a User

**Method:** POST
**URL:** `http://localhost:5000/api/auth/register`
**Headers:**

```
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Test123!",
  "full_name": "Test User",
  "role": "viewer"
}
```

**Expected Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "role": "viewer"
  }
}
```

**⚠️ IMPORTANT:** Copy the `token` value! You'll need it for all other requests.

---

### Step 2: Login (Alternative to Register)

**Method:** POST
**URL:** `http://localhost:5000/api/auth/login`
**Headers:**

```
Content-Type: application/json
```

**Body (JSON):**

```json
{
  "email": "test@example.com",
  "password": "Test123!"
}
```

---

### Step 3: Get Current User (Test Authentication)

**Method:** GET
**URL:** `http://localhost:5000/api/auth/me`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**✅ If this works, your authentication is working correctly!**

---

## 📦 CREATE TEST DATA

### Create a Region

**Method:** POST
**URL:** `http://localhost:5000/api/regions`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "name": "Test Zone",
  "code": "TZ001",
  "type": "zone",
  "latitude": 28.6139,
  "longitude": 77.209,
  "description": "Test operational zone",
  "parent_region_id": null
}
```

---

### Create a Distance Measurement

**Method:** POST
**URL:** `http://localhost:5000/api/measurements/distance`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "measurement_name": "Test Measurement",
  "points": [
    { "lat": 28.6139, "lng": 77.209 },
    { "lat": 28.615, "lng": 77.21 }
  ],
  "total_distance": 150.5,
  "unit": "meters",
  "region_id": 1,
  "is_saved": true
}
```

---

### Create a Polygon

**Method:** POST
**URL:** `http://localhost:5000/api/drawings/polygon`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "polygon_name": "Test Coverage Area",
  "coordinates": [
    { "lat": 28.6139, "lng": 77.209 },
    { "lat": 28.62, "lng": 77.209 },
    { "lat": 28.62, "lng": 77.215 },
    { "lat": 28.6139, "lng": 77.215 },
    { "lat": 28.6139, "lng": 77.209 }
  ],
  "area": 5000000,
  "perimeter": 10000,
  "fill_color": "#3388ff",
  "opacity": 0.5,
  "region_id": 1,
  "is_saved": true
}
```

---

### Create a Circle

**Method:** POST
**URL:** `http://localhost:5000/api/drawings/circle`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "circle_name": "Test Signal Range",
  "center_lat": 28.6139,
  "center_lng": 77.209,
  "radius": 1000,
  "fill_color": "#ff6b6b",
  "opacity": 0.4,
  "region_id": 1,
  "is_saved": true
}
```

---

### Create a Sector RF

**Method:** POST
**URL:** `http://localhost:5000/api/rf/sectors`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "sector_name": "Test Tower - Sector 1",
  "tower_lat": 28.6139,
  "tower_lng": 77.209,
  "azimuth": 45,
  "beamwidth": 65,
  "radius": 1500,
  "frequency": 2400,
  "power": 43.5,
  "antenna_height": 30,
  "region_id": 1,
  "is_saved": true
}
```

---

### Create Infrastructure Item

**Method:** POST
**URL:** `http://localhost:5000/api/infrastructure`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "item_type": "tower",
  "item_name": "Test Cell Tower A1",
  "latitude": 28.6139,
  "longitude": 77.209,
  "height": 50,
  "status": "active",
  "region_id": 1,
  "notes": "Test tower"
}
```

---

### Create a Bookmark

**Method:** POST
**URL:** `http://localhost:5000/api/bookmarks`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "name": "Important Location",
  "latitude": 28.6139,
  "longitude": 77.209,
  "zoom_level": 15,
  "description": "Test bookmark"
}
```

---

## 📊 RETRIEVE DATA (GET Requests)

### Get All Measurements

**Method:** GET
**URL:** `http://localhost:5000/api/measurements/distance`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Get All Polygons

**Method:** GET
**URL:** `http://localhost:5000/api/drawings/polygon`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Get All Circles

**Method:** GET
**URL:** `http://localhost:5000/api/drawings/circle`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Get All Sectors

**Method:** GET
**URL:** `http://localhost:5000/api/rf/sectors`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Get All Infrastructure

**Method:** GET
**URL:** `http://localhost:5000/api/infrastructure`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Get All Bookmarks

**Method:** GET
**URL:** `http://localhost:5000/api/bookmarks`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Get Dashboard Analytics

**Method:** GET
**URL:** `http://localhost:5000/api/analytics/dashboard`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Global Search

**Method:** GET
**URL:** `http://localhost:5000/api/search/global?q=test`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🔄 UPDATE DATA (PUT Requests)

### Update Measurement

**Method:** PUT
**URL:** `http://localhost:5000/api/measurements/distance/1`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "measurement_name": "Updated Measurement Name",
  "notes": "Updated notes"
}
```

---

### Update Polygon

**Method:** PUT
**URL:** `http://localhost:5000/api/drawings/polygon/1`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "polygon_name": "Updated Coverage Area",
  "fill_color": "#00ff00"
}
```

---

## 🗑️ DELETE DATA (DELETE Requests)

### Delete Measurement

**Method:** DELETE
**URL:** `http://localhost:5000/api/measurements/distance/1`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Delete Polygon

**Method:** DELETE
**URL:** `http://localhost:5000/api/drawings/polygon/1`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🎯 ADVANCED TESTING

### Create a Group

**Method:** POST
**URL:** `http://localhost:5000/api/groups`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "name": "Test Engineering Team",
  "description": "Team for testing"
}
```

---

### Add Member to Group

**Method:** POST
**URL:** `http://localhost:5000/api/groups/1/members`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "userId": 2,
  "role": "member"
}
```

---

### Create Region Request

**Method:** POST
**URL:** `http://localhost:5000/api/region-requests`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "regionId": 1,
  "accessLevel": "write",
  "justification": "Need write access for testing"
}
```

---

### Get User Preferences

**Method:** GET
**URL:** `http://localhost:5000/api/preferences`
**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

### Update User Preferences

**Method:** PUT
**URL:** `http://localhost:5000/api/preferences`
**Headers:**

```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:**

```json
{
  "default_map_type": "satellite",
  "default_zoom": 12,
  "theme": "dark",
  "measurement_unit": "metric"
}
```

---

## 🐛 COMMON ERRORS & SOLUTIONS

### Error: "No token provided"

**Solution:** Make sure you include:

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Error: "Invalid or expired token"

**Solution:** Login again to get a new token (tokens expire after 15 minutes)

### Error: "Not found"

**Solution:** Check that the ID in the URL exists

### Error: "Forbidden"

**Solution:** You don't have permission (Admin/Manager/Owner required)

### Error: "Bad Request"

**Solution:** Check your JSON body format and required fields

---

## 💡 PRO TIPS

### 1. Save Your Token as Environment Variable

In Thunder Client:

- Go to "Env" tab
- Create new environment "Local"
- Add variable: `token` = your actual token
- Use in headers: `{{token}}`

### 2. Create Collections

Organize your tests:

- Auth APIs
- User Management
- GIS Tools
- Analytics
- etc.

### 3. Use Variables

```
Base URL: {{baseUrl}}/api
Where baseUrl = http://localhost:5000
```

### 4. Save Requests

Save each request for reuse later

### 5. Chain Requests

Use response values in next request:

- Save token from login
- Use in all subsequent requests

---

## ✅ TESTING CHECKLIST

### Basic Auth:

- [ ] Register new user
- [ ] Login with user
- [ ] Get current user info
- [ ] Change password
- [ ] Logout

### GIS Tools:

- [ ] Create distance measurement
- [ ] Get all measurements
- [ ] Update measurement
- [ ] Delete measurement
- [ ] Create polygon
- [ ] Create circle
- [ ] Create sector RF
- [ ] Create elevation profile

### Infrastructure:

- [ ] Create infrastructure item
- [ ] Get all infrastructure
- [ ] Update infrastructure status
- [ ] Delete infrastructure

### Search & Analytics:

- [ ] Global search
- [ ] Get dashboard analytics
- [ ] Get region analytics
- [ ] Track custom event

### User Management:

- [ ] Get all users
- [ ] Create user (admin)
- [ ] Assign region to user
- [ ] Get user's regions

### Groups:

- [ ] Create group
- [ ] Add members
- [ ] Update member role
- [ ] Remove member
- [ ] Delete group

---

## 🎉 READY TO TEST!

**Start with these 5 requests in order:**

1. Register User
2. Login
3. Get Current User (to verify token works)
4. Create a Region
5. Create a Distance Measurement

**If all 5 work, your backend is fully functional!**

Then test the remaining 117 APIs at your own pace.

---

**Happy Testing! ⚡**
