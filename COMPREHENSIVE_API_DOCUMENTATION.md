# 📚 COMPREHENSIVE API DOCUMENTATION
## OptiConnect GIS Platform - All 122 APIs

**Base URL:** `http://localhost:5000/api`
**Version:** 1.0.0
**Last Updated:** 2025

---

## 🔐 Authentication

All APIs (except login/register) require authentication via JWT token:

```javascript
Headers: {
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

---

# 📑 TABLE OF CONTENTS

1. [Authentication APIs (5)](#authentication-apis)
2. [User Management APIs (12)](#user-management-apis)
3. [Region Management APIs (8)](#region-management-apis)
4. [Group Management APIs (9)](#group-management-apis)
5. [GIS Features APIs (7)](#gis-features-apis)
6. [Distance Measurement APIs (5)](#distance-measurement-apis)
7. [Polygon Drawing APIs (5)](#polygon-drawing-apis)
8. [Circle Drawing APIs (5)](#circle-drawing-apis)
9. [Sector RF APIs (6)](#sector-rf-apis)
10. [Elevation Profile APIs (5)](#elevation-profile-apis)
11. [Infrastructure APIs (7)](#infrastructure-apis)
12. [Layer Management APIs (7)](#layer-management-apis)
13. [Bookmark APIs (4)](#bookmark-apis)
14. [Search APIs (6)](#search-apis)
15. [Analytics APIs (5)](#analytics-apis)
16. [Audit Log APIs (3)](#audit-log-apis)
17. [User Preferences APIs (3)](#user-preferences-apis)
18. [Data Hub APIs (5)](#data-hub-apis)
19. [Temporary Access APIs (3)](#temporary-access-apis)
20. [Region Request APIs (4)](#region-request-apis)
21. [Permission APIs (3)](#permission-apis)

---

<a name="authentication-apis"></a>
# 1️⃣ AUTHENTICATION APIS (5)

**Base:** `/api/auth`

## 1.1 Register User

**Endpoint:** `POST /api/auth/register`
**Auth Required:** ❌ No

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "role": "viewer",
  "phone": "1234567890",
  "department": "Engineering"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "viewer",
    "is_active": true,
    "created_at": "2025-01-10T10:30:00.000Z"
  }
}
```

**Table:** `users`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| username | VARCHAR(100) | Unique username |
| email | VARCHAR(255) | Unique email |
| password_hash | VARCHAR(255) | Bcrypt hashed password |
| full_name | VARCHAR(255) | Full name |
| role | ENUM | admin, manager, viewer, engineer |
| phone | VARCHAR(20) | Phone number |
| department | VARCHAR(100) | Department |
| is_active | BOOLEAN | Active status |
| created_at | TIMESTAMP | Creation timestamp |

---

## 1.2 Login User

**Endpoint:** `POST /api/auth/login`
**Auth Required:** ❌ No

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "viewer",
    "region": {
      "id": 5,
      "name": "North Zone",
      "code": "NZ001"
    }
  }
}
```

**Token Expires:** 15 minutes

---

## 1.3 Get Current User

**Endpoint:** `GET /api/auth/me`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "viewer",
    "phone": "1234567890",
    "department": "Engineering",
    "is_active": true,
    "regions": [
      {
        "id": 5,
        "name": "North Zone",
        "access_level": "read"
      }
    ]
  }
}
```

---

## 1.4 Change Password

**Endpoint:** `POST /api/auth/change-password`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "oldPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 1.5 Logout

**Endpoint:** `POST /api/auth/logout`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

<a name="user-management-apis"></a>
# 2️⃣ USER MANAGEMENT APIS (12)

**Base:** `/api/users`

## 2.1 Get All Users

**Endpoint:** `GET /api/users?page=1&limit=10&search=john`
**Auth Required:** ✅ Yes

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search term

**Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "john_doe",
      "email": "john@example.com",
      "full_name": "John Doe",
      "role": "viewer",
      "is_active": true,
      "created_at": "2025-01-10T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

---

## 2.2 Get User by ID

**Endpoint:** `GET /api/users/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "viewer",
    "phone": "1234567890",
    "department": "Engineering",
    "is_active": true,
    "last_login": "2025-01-10T14:25:00.000Z",
    "created_at": "2025-01-10T10:30:00.000Z"
  }
}
```

---

## 2.3 Create User

**Endpoint:** `POST /api/users`
**Auth Required:** ✅ Yes (Admin only)

**Request Body:**
```json
{
  "username": "jane_smith",
  "email": "jane@example.com",
  "password": "TempPass123!",
  "full_name": "Jane Smith",
  "role": "manager",
  "phone": "0987654321",
  "department": "Operations"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "username": "jane_smith",
    "email": "jane@example.com",
    "role": "manager"
  }
}
```

---

## 2.4 Update User

**Endpoint:** `PUT /api/users/:id`
**Auth Required:** ✅ Yes (Own profile or Admin)

**Request Body:**
```json
{
  "full_name": "John D. Doe",
  "phone": "1111222233",
  "department": "R&D"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User updated successfully"
}
```

---

## 2.5 Delete User

**Endpoint:** `DELETE /api/users/:id`
**Auth Required:** ✅ Yes (Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## 2.6 Activate User

**Endpoint:** `PATCH /api/users/:id/activate`
**Auth Required:** ✅ Yes (Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User activated successfully"
}
```

---

## 2.7 Deactivate User

**Endpoint:** `PATCH /api/users/:id/deactivate`
**Auth Required:** ✅ Yes (Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

---

## 2.8 Get User's Regions

**Endpoint:** `GET /api/users/:id/regions`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "regions": [
    {
      "id": 5,
      "name": "North Zone",
      "code": "NZ001",
      "type": "zone",
      "access_level": "read",
      "assigned_at": "2025-01-10T10:30:00.000Z"
    }
  ]
}
```

---

## 2.9 Assign Region to User

**Endpoint:** `POST /api/users/:id/regions`
**Auth Required:** ✅ Yes (Admin only)

**Request Body:**
```json
{
  "regionId": 5,
  "accessLevel": "write"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Region assigned successfully"
}
```

---

## 2.10 Unassign Region from User

**Endpoint:** `DELETE /api/users/:id/regions/:regionId`
**Auth Required:** ✅ Yes (Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Region unassigned successfully"
}
```

---

<a name="region-management-apis"></a>
# 3️⃣ REGION MANAGEMENT APIS (8)

**Base:** `/api/regions`

**Table:** `regions`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(255) | Region name |
| code | VARCHAR(50) | Unique region code |
| type | ENUM | country, state, district, zone, custom |
| parent_region_id | INT | Parent region ID |
| latitude | DECIMAL(10,8) | Center latitude |
| longitude | DECIMAL(11,8) | Center longitude |
| boundary_geojson | TEXT | GeoJSON boundary |
| description | TEXT | Description |
| is_active | BOOLEAN | Active status |

---

## 3.1 Get All Regions

**Endpoint:** `GET /api/regions`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "regions": [
    {
      "id": 1,
      "name": "India",
      "code": "IN",
      "type": "country",
      "latitude": 20.5937,
      "longitude": 78.9629,
      "parent_region_id": null,
      "is_active": true
    },
    {
      "id": 5,
      "name": "North Zone",
      "code": "NZ001",
      "type": "zone",
      "parent_region_id": 1,
      "is_active": true
    }
  ]
}
```

---

## 3.2 Get Region by ID

**Endpoint:** `GET /api/regions/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "region": {
    "id": 5,
    "name": "North Zone",
    "code": "NZ001",
    "type": "zone",
    "parent_region_id": 1,
    "latitude": 28.6139,
    "longitude": 77.2090,
    "boundary_geojson": "{...}",
    "description": "Northern operational zone",
    "is_active": true,
    "created_at": "2025-01-05T08:00:00.000Z"
  }
}
```

---

## 3.3 Create Region

**Endpoint:** `POST /api/regions`
**Auth Required:** ✅ Yes (Admin only)

**Request Body:**
```json
{
  "name": "West Zone",
  "code": "WZ001",
  "type": "zone",
  "parent_region_id": 1,
  "latitude": 19.0760,
  "longitude": 72.8777,
  "description": "Western operational zone"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "region": {
    "id": 6,
    "name": "West Zone",
    "code": "WZ001"
  }
}
```

---

## 3.4 Update Region

**Endpoint:** `PUT /api/regions/:id`
**Auth Required:** ✅ Yes (Admin only)

**Request Body:**
```json
{
  "name": "West Zone Updated",
  "description": "Updated description"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Region updated successfully"
}
```

---

## 3.5 Delete Region

**Endpoint:** `DELETE /api/regions/:id`
**Auth Required:** ✅ Yes (Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Region deleted successfully"
}
```

---

## 3.6 Get Child Regions

**Endpoint:** `GET /api/regions/:id/children`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "children": [
    {
      "id": 5,
      "name": "North Zone",
      "code": "NZ001",
      "type": "zone"
    },
    {
      "id": 6,
      "name": "West Zone",
      "code": "WZ001",
      "type": "zone"
    }
  ]
}
```

---

## 3.7 Get Region Users

**Endpoint:** `GET /api/regions/:id/users`
**Auth Required:** ✅ Yes (Manager+)

**Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "john_doe",
      "full_name": "John Doe",
      "role": "viewer",
      "access_level": "read"
    }
  ]
}
```

---

## 3.8 Get Region Hierarchy

**Endpoint:** `GET /api/regions/hierarchy`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "hierarchy": [
    {
      "id": 1,
      "name": "India",
      "code": "IN",
      "children": [
        {
          "id": 5,
          "name": "North Zone",
          "code": "NZ001",
          "children": []
        }
      ]
    }
  ]
}
```

---

<a name="group-management-apis"></a>
# 4️⃣ GROUP MANAGEMENT APIS (9)

**Base:** `/api/groups`

**Tables:** `groups`, `group_members`

## 4.1 Get All Groups

**Endpoint:** `GET /api/groups`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "groups": [
    {
      "id": 1,
      "name": "Engineering Team",
      "description": "Main engineering group",
      "member_count": 5,
      "user_role": "owner",
      "created_at": "2025-01-05T10:00:00.000Z"
    }
  ]
}
```

---

## 4.2 Get Group by ID

**Endpoint:** `GET /api/groups/:id`
**Auth Required:** ✅ Yes (Member only)

**Response (200 OK):**
```json
{
  "success": true,
  "group": {
    "id": 1,
    "name": "Engineering Team",
    "description": "Main engineering group",
    "owner_id": 1,
    "owner_name": "John Doe",
    "member_count": 5,
    "created_at": "2025-01-05T10:00:00.000Z"
  }
}
```

---

## 4.3 Create Group

**Endpoint:** `POST /api/groups`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "name": "Project Alpha Team",
  "description": "Team for Project Alpha"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "group": {
    "id": 2,
    "name": "Project Alpha Team"
  }
}
```

---

## 4.4 Update Group

**Endpoint:** `PUT /api/groups/:id`
**Auth Required:** ✅ Yes (Owner only)

**Request Body:**
```json
{
  "name": "Project Alpha Team Updated",
  "description": "Updated description"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Group updated successfully"
}
```

---

## 4.5 Delete Group

**Endpoint:** `DELETE /api/groups/:id`
**Auth Required:** ✅ Yes (Owner only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Group deleted successfully"
}
```

---

## 4.6 Get Group Members

**Endpoint:** `GET /api/groups/:id/members`
**Auth Required:** ✅ Yes (Member only)

**Response (200 OK):**
```json
{
  "success": true,
  "members": [
    {
      "user_id": 1,
      "username": "john_doe",
      "full_name": "John Doe",
      "role": "owner",
      "joined_at": "2025-01-05T10:00:00.000Z"
    },
    {
      "user_id": 2,
      "username": "jane_smith",
      "full_name": "Jane Smith",
      "role": "member",
      "joined_at": "2025-01-06T12:00:00.000Z"
    }
  ]
}
```

---

## 4.7 Add Group Member

**Endpoint:** `POST /api/groups/:id/members`
**Auth Required:** ✅ Yes (Owner/Admin only)

**Request Body:**
```json
{
  "userId": 3,
  "role": "member"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Member added successfully"
}
```

---

## 4.8 Remove Group Member

**Endpoint:** `DELETE /api/groups/:id/members/:userId`
**Auth Required:** ✅ Yes (Owner/Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Member removed successfully"
}
```

---

## 4.9 Update Member Role

**Endpoint:** `PATCH /api/groups/:id/members/:userId`
**Auth Required:** ✅ Yes (Owner only)

**Request Body:**
```json
{
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Member role updated successfully"
}
```

---

<a name="gis-features-apis"></a>
# 5️⃣ GIS FEATURES APIS (7)

**Base:** `/api/features`

**Table:** `gis_features`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | Creator user ID |
| region_id | INT | Region ID |
| name | VARCHAR(255) | Feature name |
| feature_type | VARCHAR(100) | Type (point, line, polygon) |
| geometry | JSON | GeoJSON geometry |
| latitude | DECIMAL(10,8) | Center latitude |
| longitude | DECIMAL(11,8) | Center longitude |
| properties | JSON | Custom properties |
| description | TEXT | Description |
| style | JSON | Display style |

---

## 5.1 Get All Features

**Endpoint:** `GET /api/features?regionId=5`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "features": [
    {
      "id": 1,
      "name": "Cell Tower A1",
      "feature_type": "point",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "region_id": 5,
      "region_name": "North Zone",
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ]
}
```

---

## 5.2 Get Feature by ID

**Endpoint:** `GET /api/features/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "feature": {
    "id": 1,
    "name": "Cell Tower A1",
    "feature_type": "point",
    "geometry": {
      "type": "Point",
      "coordinates": [77.2090, 28.6139]
    },
    "latitude": 28.6139,
    "longitude": 77.2090,
    "properties": {
      "height": 50,
      "operator": "Telecom XYZ"
    },
    "description": "Main cell tower",
    "style": {
      "color": "#ff0000",
      "icon": "tower"
    },
    "region_id": 5,
    "created_at": "2025-01-10T10:00:00.000Z"
  }
}
```

---

## 5.3 Create Feature

**Endpoint:** `POST /api/features`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "name": "Cell Tower B2",
  "feature_type": "point",
  "geometry": {
    "type": "Point",
    "coordinates": [77.3090, 28.7139]
  },
  "latitude": 28.7139,
  "longitude": 77.3090,
  "region_id": 5,
  "properties": {
    "height": 45,
    "operator": "Telecom ABC"
  },
  "description": "Secondary cell tower",
  "style": {
    "color": "#00ff00",
    "icon": "tower"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "feature": {
    "id": 2,
    "name": "Cell Tower B2"
  }
}
```

---

## 5.4 Update Feature

**Endpoint:** `PUT /api/features/:id`
**Auth Required:** ✅ Yes (Owner/Admin only)

**Request Body:**
```json
{
  "name": "Cell Tower B2 Updated",
  "description": "Updated description",
  "properties": {
    "height": 50,
    "operator": "Telecom ABC",
    "status": "active"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Feature updated successfully"
}
```

---

## 5.5 Delete Feature

**Endpoint:** `DELETE /api/features/:id`
**Auth Required:** ✅ Yes (Owner/Admin only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Feature deleted successfully"
}
```

---

## 5.6 Find Nearby Features

**Endpoint:** `GET /api/features/nearby?lat=28.6139&lng=77.2090&radius=5000`
**Auth Required:** ✅ Yes

**Query Parameters:**
- `lat`: Latitude (required)
- `lng`: Longitude (required)
- `radius`: Search radius in meters (default: 1000)

**Response (200 OK):**
```json
{
  "success": true,
  "features": [
    {
      "id": 1,
      "name": "Cell Tower A1",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "distance": 150.5,
      "feature_type": "point"
    },
    {
      "id": 2,
      "name": "Cell Tower B2",
      "latitude": 28.6200,
      "longitude": 77.2100,
      "distance": 850.2,
      "feature_type": "point"
    }
  ]
}
```

---

## 5.7 Get Features by Region

**Endpoint:** `GET /api/features/region/:regionId`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "features": [
    {
      "id": 1,
      "name": "Cell Tower A1",
      "feature_type": "point",
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  ]
}
```

---

<a name="distance-measurement-apis"></a>
# 6️⃣ DISTANCE MEASUREMENT APIS (5)

**Base:** `/api/measurements/distance`

**Table:** `distance_measurements`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | User ID (owner) |
| region_id | INT | Region ID |
| measurement_name | VARCHAR(255) | Measurement name |
| points | JSON | Array of {lat, lng} points |
| total_distance | DECIMAL(15,4) | Total distance in meters |
| unit | ENUM | meters, kilometers, miles |
| map_snapshot_url | VARCHAR(500) | Snapshot URL |
| notes | TEXT | Notes |
| is_saved | BOOLEAN | Saved status |

---

## 6.1 Get All Measurements

**Endpoint:** `GET /api/measurements/distance?regionId=5`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "measurements": [
    {
      "id": 1,
      "measurement_name": "Tower to Building A",
      "total_distance": 1250.5,
      "unit": "meters",
      "region_id": 5,
      "is_saved": true,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ]
}
```

---

## 6.2 Get Measurement by ID

**Endpoint:** `GET /api/measurements/distance/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "measurement": {
    "id": 1,
    "measurement_name": "Tower to Building A",
    "points": [
      {"lat": 28.6139, "lng": 77.2090},
      {"lat": 28.6150, "lng": 77.2100},
      {"lat": 28.6160, "lng": 77.2110}
    ],
    "total_distance": 1250.5,
    "unit": "meters",
    "region_id": 5,
    "notes": "Fiber route measurement",
    "is_saved": true,
    "created_at": "2025-01-10T10:00:00.000Z"
  }
}
```

---

## 6.3 Create Measurement

**Endpoint:** `POST /api/measurements/distance`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "measurement_name": "Tower to Building B",
  "points": [
    {"lat": 28.6139, "lng": 77.2090},
    {"lat": 28.6200, "lng": 77.2150}
  ],
  "total_distance": 852.3,
  "unit": "meters",
  "region_id": 5,
  "notes": "Power line route",
  "is_saved": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "measurement": {
    "id": 2,
    "measurement_name": "Tower to Building B",
    "total_distance": 852.3,
    "unit": "meters"
  }
}
```

---

## 6.4 Update Measurement

**Endpoint:** `PUT /api/measurements/distance/:id`
**Auth Required:** ✅ Yes (Owner only)

**Request Body:**
```json
{
  "measurement_name": "Tower to Building B Updated",
  "notes": "Updated notes",
  "is_saved": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Measurement updated successfully"
}
```

---

## 6.5 Delete Measurement

**Endpoint:** `DELETE /api/measurements/distance/:id`
**Auth Required:** ✅ Yes (Owner only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Measurement deleted successfully"
}
```

---

<a name="polygon-drawing-apis"></a>
# 7️⃣ POLYGON DRAWING APIS (5)

**Base:** `/api/drawings/polygon`

**Table:** `polygon_drawings`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | User ID (owner) |
| region_id | INT | Region ID |
| polygon_name | VARCHAR(255) | Polygon name |
| coordinates | JSON | Array of {lat, lng} points |
| area | DECIMAL(15,4) | Area in square meters |
| perimeter | DECIMAL(15,4) | Perimeter in meters |
| fill_color | VARCHAR(20) | Fill color (hex) |
| stroke_color | VARCHAR(20) | Stroke color (hex) |
| opacity | DECIMAL(3,2) | Opacity (0.0-1.0) |
| properties | JSON | Custom properties |
| notes | TEXT | Notes |
| is_saved | BOOLEAN | Saved status |

---

## 7.1 Get All Polygons

**Endpoint:** `GET /api/drawings/polygon?regionId=5`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "polygons": [
    {
      "id": 1,
      "polygon_name": "Coverage Area A",
      "area": 5000000,
      "perimeter": 10000,
      "fill_color": "#3388ff",
      "opacity": 0.5,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ]
}
```

---

## 7.2 Get Polygon by ID

**Endpoint:** `GET /api/drawings/polygon/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "polygon": {
    "id": 1,
    "polygon_name": "Coverage Area A",
    "coordinates": [
      {"lat": 28.6139, "lng": 77.2090},
      {"lat": 28.6200, "lng": 77.2090},
      {"lat": 28.6200, "lng": 77.2150},
      {"lat": 28.6139, "lng": 77.2150},
      {"lat": 28.6139, "lng": 77.2090}
    ],
    "area": 5000000,
    "perimeter": 10000,
    "fill_color": "#3388ff",
    "stroke_color": "#3388ff",
    "opacity": 0.5,
    "properties": {
      "zone": "high_priority",
      "coverage_type": "5G"
    },
    "notes": "Primary coverage zone",
    "is_saved": true
  }
}
```

---

## 7.3 Create Polygon

**Endpoint:** `POST /api/drawings/polygon`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "polygon_name": "Coverage Area B",
  "coordinates": [
    {"lat": 28.7000, "lng": 77.3000},
    {"lat": 28.7100, "lng": 77.3000},
    {"lat": 28.7100, "lng": 77.3100},
    {"lat": 28.7000, "lng": 77.3100},
    {"lat": 28.7000, "lng": 77.3000}
  ],
  "area": 6000000,
  "perimeter": 11000,
  "fill_color": "#ff6b6b",
  "stroke_color": "#ff6b6b",
  "opacity": 0.4,
  "region_id": 5,
  "properties": {
    "zone": "medium_priority",
    "coverage_type": "4G"
  },
  "notes": "Secondary coverage zone",
  "is_saved": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "polygon": {
    "id": 2,
    "polygon_name": "Coverage Area B",
    "area": 6000000,
    "perimeter": 11000
  }
}
```

---

## 7.4 Update Polygon

**Endpoint:** `PUT /api/drawings/polygon/:id`
**Auth Required:** ✅ Yes (Owner only)

**Request Body:**
```json
{
  "polygon_name": "Coverage Area B Updated",
  "fill_color": "#00ff00",
  "opacity": 0.6,
  "notes": "Updated notes"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Polygon updated successfully"
}
```

---

## 7.5 Delete Polygon

**Endpoint:** `DELETE /api/drawings/polygon/:id`
**Auth Required:** ✅ Yes (Owner only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Polygon deleted successfully"
}
```

---

<a name="circle-drawing-apis"></a>
# 8️⃣ CIRCLE DRAWING APIS (5)

**Base:** `/api/drawings/circle`

**Table:** `circle_drawings`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | User ID (owner) |
| region_id | INT | Region ID |
| circle_name | VARCHAR(255) | Circle name |
| center_lat | DECIMAL(10,8) | Center latitude |
| center_lng | DECIMAL(11,8) | Center longitude |
| radius | DECIMAL(15,4) | Radius in meters |
| fill_color | VARCHAR(20) | Fill color (hex) |
| stroke_color | VARCHAR(20) | Stroke color (hex) |
| opacity | DECIMAL(3,2) | Opacity (0.0-1.0) |
| properties | JSON | Custom properties |
| notes | TEXT | Notes |
| is_saved | BOOLEAN | Saved status |

---

## 8.1 Get All Circles

**Endpoint:** `GET /api/drawings/circle?regionId=5`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "circles": [
    {
      "id": 1,
      "circle_name": "Signal Range A",
      "center_lat": 28.6139,
      "center_lng": 77.2090,
      "radius": 1000,
      "fill_color": "#3388ff",
      "opacity": 0.3,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ]
}
```

---

## 8.2 Get Circle by ID

**Endpoint:** `GET /api/drawings/circle/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "circle": {
    "id": 1,
    "circle_name": "Signal Range A",
    "center_lat": 28.6139,
    "center_lng": 77.2090,
    "radius": 1000,
    "fill_color": "#3388ff",
    "stroke_color": "#3388ff",
    "opacity": 0.3,
    "properties": {
      "signal_strength": "strong",
      "frequency": "2.4GHz"
    },
    "notes": "Primary signal coverage",
    "is_saved": true
  }
}
```

---

## 8.3 Create Circle

**Endpoint:** `POST /api/drawings/circle`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "circle_name": "Signal Range B",
  "center_lat": 28.7000,
  "center_lng": 77.3000,
  "radius": 1500,
  "fill_color": "#ff6b6b",
  "stroke_color": "#ff6b6b",
  "opacity": 0.4,
  "region_id": 5,
  "properties": {
    "signal_strength": "medium",
    "frequency": "5GHz"
  },
  "notes": "Secondary signal coverage",
  "is_saved": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "circle": {
    "id": 2,
    "circle_name": "Signal Range B",
    "center_lat": 28.7000,
    "center_lng": 77.3000,
    "radius": 1500
  }
}
```

---

## 8.4 Update Circle

**Endpoint:** `PUT /api/drawings/circle/:id`
**Auth Required:** ✅ Yes (Owner only)

**Request Body:**
```json
{
  "circle_name": "Signal Range B Updated",
  "fill_color": "#00ff00",
  "opacity": 0.5,
  "notes": "Updated notes"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Circle updated successfully"
}
```

---

## 8.5 Delete Circle

**Endpoint:** `DELETE /api/drawings/circle/:id`
**Auth Required:** ✅ Yes (Owner only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Circle deleted successfully"
}
```

---

<a name="sector-rf-apis"></a>
# 9️⃣ SECTOR RF APIS (6)

**Base:** `/api/rf/sectors`

**Table:** `sector_rf_data`

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | User ID (owner) |
| region_id | INT | Region ID |
| sector_name | VARCHAR(255) | Sector name |
| tower_lat | DECIMAL(10,8) | Tower latitude |
| tower_lng | DECIMAL(11,8) | Tower longitude |
| azimuth | DECIMAL(5,2) | Azimuth angle (degrees) |
| beamwidth | DECIMAL(5,2) | Beamwidth (degrees) |
| radius | DECIMAL(15,4) | Coverage radius (meters) |
| frequency | DECIMAL(10,2) | Frequency (MHz) |
| power | DECIMAL(8,2) | Transmit power (dBm) |
| antenna_height | DECIMAL(8,2) | Antenna height (meters) |
| antenna_type | VARCHAR(100) | Antenna type |
| fill_color | VARCHAR(20) | Fill color |
| stroke_color | VARCHAR(20) | Stroke color |
| opacity | DECIMAL(3,2) | Opacity |
| properties | JSON | RF properties |

---

## 9.1 Get All Sectors

**Endpoint:** `GET /api/rf/sectors?regionId=5`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "sectors": [
    {
      "id": 1,
      "sector_name": "Tower A - Sector 1",
      "tower_lat": 28.6139,
      "tower_lng": 77.2090,
      "azimuth": 45,
      "beamwidth": 65,
      "radius": 1500,
      "frequency": 2400,
      "created_at": "2025-01-10T10:00:00.000Z"
    }
  ]
}
```

---

## 9.2 Get Sector by ID

**Endpoint:** `GET /api/rf/sectors/:id`
**Auth Required:** ✅ Yes

**Response (200 OK):**
```json
{
  "success": true,
  "sector": {
    "id": 1,
    "sector_name": "Tower A - Sector 1",
    "tower_lat": 28.6139,
    "tower_lng": 77.2090,
    "azimuth": 45,
    "beamwidth": 65,
    "radius": 1500,
    "frequency": 2400,
    "power": 43.5,
    "antenna_height": 30,
    "antenna_type": "Directional 65°",
    "fill_color": "#ff6b6b",
    "stroke_color": "#ff6b6b",
    "opacity": 0.4,
    "properties": {
      "technology": "5G",
      "band": "n78"
    },
    "notes": "Primary sector",
    "is_saved": true
  }
}
```

---

## 9.3 Create Sector

**Endpoint:** `POST /api/rf/sectors`
**Auth Required:** ✅ Yes

**Request Body:**
```json
{
  "sector_name": "Tower A - Sector 2",
  "tower_lat": 28.6139,
  "tower_lng": 77.2090,
  "azimuth": 135,
  "beamwidth": 65,
  "radius": 1500,
  "frequency": 2400,
  "power": 43.5,
  "antenna_height": 30,
  "antenna_type": "Directional 65°",
  "fill_color": "#ff6b6b",
  "stroke_color": "#ff6b6b",
  "opacity": 0.4,
  "region_id": 5,
  "properties": {
    "technology": "5G",
    "band": "n78"
  },
  "notes": "Second sector",
  "is_saved": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "sector": {
    "id": 2,
    "sector_name": "Tower A - Sector 2",
    "azimuth": 135,
    "beamwidth": 65,
    "radius": 1500
  }
}
```

---

## 9.4 Update Sector

**Endpoint:** `PUT /api/rf/sectors/:id`
**Auth Required:** ✅ Yes (Owner only)

**Request Body:**
```json
{
  "sector_name": "Tower A - Sector 2 Updated",
  "frequency": 2600,
  "power": 45.0,
  "notes": "Updated notes"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sector updated successfully"
}
```

---

## 9.5 Delete Sector

**Endpoint:** `DELETE /api/rf/sectors/:id`
**Auth Required:** ✅ Yes (Owner only)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Sector deleted successfully"
}
```

---

## 9.6 Calculate Coverage

**Endpoint:** `POST /api/rf/sectors/:id/calculate`
**Auth Required:** ✅ Yes (Owner only)

**Response (200 OK):**
```json
{
  "success": true,
  "coverage": {
    "sector_id": 1,
    "predicted_range": 1500,
    "coverage_area": 7068583,
    "signal_strength": "Good",
    "interference_level": "Low"
  }
}
```

---

*Due to character limits, this document continues with remaining API categories...*

# API Documentation Continues...

Would you like me to create the complete documentation file? It will include all remaining categories:
- Elevation Profile APIs
- Infrastructure APIs
- Layer Management APIs
- Bookmarks, Search, Analytics
- Audit, Preferences, Data Hub
- Temporary Access, Region Requests, Permissions

Total documentation size will be approximately 15,000+ lines with full examples for all 122 APIs.
