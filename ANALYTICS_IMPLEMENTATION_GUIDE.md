# Analytics Dashboard Implementation Guide

## Overview

The Analytics Dashboard has been enhanced with **real-time API performance monitoring** and **usage trends analysis** using real backend data. This guide explains the implementation and how to set it up.

## What's Been Implemented

### 1. **Backend Performance Tracking**

#### Performance Middleware
- **File**: `src/middleware/performanceTracking.js`
- **Purpose**: Automatically tracks all API requests
- **Metrics Tracked**:
  - Request latency (response time in ms)
  - HTTP status codes
  - Endpoint paths
  - User IDs
  - Timestamps

#### Features:
- In-memory buffering (reduces database load)
- Batch inserts (every 50 requests or 30 seconds)
- Graceful shutdown handling
- No impact on API performance

### 2. **Database Table**

#### api_performance_logs Table
```sql
CREATE TABLE api_performance_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  latency_ms INT NOT NULL,
  status_code INT NOT NULL,
  user_id INT NULL,
  timestamp DATETIME NOT NULL,
  -- Optimized indexes for fast queries
  INDEX idx_timestamp (timestamp),
  INDEX idx_endpoint (endpoint(255)),
  INDEX idx_user_id (user_id),
  INDEX idx_composite (timestamp, endpoint(100), user_id)
);
```

### 3. **Analytics API Endpoints**

#### GET /api/analytics/performance
**Query Parameters**:
- `timeRange`: `1h` | `24h` | `7d` | `30d` (default: `24h`)

**Response**:
```json
{
  "success": true,
  "data": {
    "timeRange": "24h",
    "latencyOverTime": [
      {
        "time_bucket": "2025-10-17 10:00:00",
        "avg_latency": 45.2,
        "min_latency": 12.3,
        "max_latency": 156.8,
        "request_count": 234
      }
    ],
    "topEndpoints": [
      {
        "endpoint": "/api/infrastructure",
        "request_count": 1234,
        "avg_latency": 67.5,
        "min_latency": 23.1,
        "max_latency": 345.2
      }
    ],
    "statusCodeDistribution": [
      { "status_code": 200, "count": 5432 },
      { "status_code": 401, "count": 12 }
    ],
    "overall": {
      "total_requests": 5444,
      "avg_latency": 65.3,
      "min_latency": 10.2,
      "max_latency": 450.1,
      "successful_requests": 5432,
      "failed_requests": 12
    }
  }
}
```

#### GET /api/analytics/usage-trends
**Query Parameters**:
- `timeRange`: `7d` | `30d` | `90d` (default: `30d`)

**Response**:
```json
{
  "success": true,
  "data": {
    "timeRange": "30d",
    "trends": [
      {
        "date": "2025-10-01",
        "measurements": 5,
        "polygons": 3,
        "infrastructure": 2
      }
    ]
  }
}
```

#### GET /api/analytics/system-health
**Access**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "database": {
      "size_mb": "125.45",
      "tables": [
        { "table_name": "users", "table_rows": 1234 }
      ]
    },
    "api": {
      "error_rate": "0.22%",
      "total_requests_last_hour": 5444
    },
    "connections": 8
  }
}
```

#### GET /api/analytics/recent-activity
**Access**: All authenticated users
- Admin/Manager: See all user activities including their own
- Regular users: See only their own activities

**Query Parameters**:
- `limit`: Number of activities to return (default: 20)

**Response**:
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "measurement-123",
        "user": "John Doe",
        "userRole": "technician",
        "action": "Completed Distance Measurement",
        "details": "5.43 km",
        "region": "Delhi",
        "timestamp": "2025-10-17T10:30:00.000Z",
        "type": "measurement"
      },
      {
        "id": "polygon-456",
        "user": "Jane Smith",
        "userRole": "user",
        "action": "Completed Polygon Drawing",
        "details": "2.15 km²",
        "region": "Mumbai",
        "timestamp": "2025-10-17T10:25:00.000Z",
        "type": "polygon"
      }
    ],
    "count": 10,
    "viewingAsRole": "admin"
  }
}
```

### 4. **Frontend Components**

#### APILatencyChart.tsx
- **Location**: `src/components/analytics/APILatencyChart.tsx`
- **Features**:
  - Real-time latency visualization
  - KPI cards (Total Requests, Avg Latency, Success Rate, Failed Requests)
  - Area chart showing min/avg/max latency over time
  - Top 10 endpoints table
  - Status code distribution
  - Time range selector (1h, 24h, 7d, 30d)
  - Auto-refresh every 60 seconds

#### UsageTrendsChart.tsx
- **Location**: `src/components/analytics/UsageTrendsChart.tsx`
- **Features**:
  - Feature creation trends (measurements, polygons, infrastructure)
  - Summary cards showing totals
  - Line chart visualization
  - Daily breakdown table (last 7 days)
  - Time range selector (7d, 30d, 90d)
  - Auto-refresh every 5 minutes

#### Enhanced AnalyticsPage.tsx
- **Location**: `src/pages/AnalyticsPage.tsx`
- **Features**:
  - Tab navigation (Overview, API Performance, Usage Trends)
  - Overview tab: DashboardLayout + quick charts
  - Performance tab: Detailed API monitoring
  - Usage tab: Detailed usage analysis
  - Helpful tooltips and information cards

#### DashboardLayout.tsx (Recent Activity)
- **Location**: `src/components/dashboard/DashboardLayout.tsx`
- **Features**:
  - Real-time recent activity from backend
  - Role-based activity filtering (admin/manager see all, users see own)
  - Activity type indicators with color coding
  - Relative timestamp formatting ("2 minutes ago")
  - Auto-refresh with dashboard data
  - Loading and empty states
  - Activity details display (user, action, region, time)

## Installation & Setup

### Step 1: Run Database Migration

```bash
cd OptiConnect_Backend
node run-performance-migration.js
```

This creates the `api_performance_logs` table with optimized indexes.

### Step 2: Restart Backend Server

The performance middleware is already integrated in `server.js:40-41`.

```bash
npm start
```

### Step 3: Use the Application

The performance tracking middleware will automatically start logging API requests once the server is running.

### Step 4: View Analytics Dashboard

Navigate to the Analytics page in your frontend application. The charts will display "No data" until API requests are logged.

## How It Works

### Performance Tracking Flow:
1. User makes an API request (e.g., `GET /api/infrastructure`)
2. Performance middleware captures request start time
3. Request is processed normally
4. Middleware captures end time and calculates latency
5. Performance data is buffered in memory
6. Every 50 requests (or 30 seconds), data is batch-inserted to database
7. Frontend fetches aggregated metrics from `/api/analytics/performance`
8. Charts display real-time data and auto-refresh

### Usage Trends Flow:
1. User creates features (measurements, polygons, infrastructure)
2. Created items are stored in their respective tables with timestamps
3. Frontend fetches trends from `/api/analytics/usage-trends`
4. Backend aggregates data by date and feature type
5. Charts display activity over time

## Testing the Analytics Dashboard

### 1. Generate Some Performance Data

Make several API calls to generate performance logs:

```bash
# Example using curl
curl http://localhost:5005/api/infrastructure -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:5005/api/measurements/distance -H "Authorization: Bearer YOUR_TOKEN"
curl http://localhost:5005/api/users -H "Authorization: Bearer YOUR_TOKEN"
```

Or simply use the application normally - every API call is tracked automatically.

### 2. View Performance Metrics

1. Navigate to **Analytics > API Performance** tab
2. You should see:
   - Total requests count
   - Average latency in milliseconds
   - Success rate percentage
   - Chart showing latency trends
   - List of top endpoints
   - Status code distribution

### 3. Generate Usage Data

1. Create some infrastructure items
2. Draw polygons on the map
3. Create distance measurements

### 4. View Usage Trends

1. Navigate to **Analytics > Usage Trends** tab
2. You should see:
   - Total items created
   - Trend charts over time
   - Daily breakdown table

## Performance Optimization

The implementation includes several optimizations:

1. **Batch Inserts**: Reduces database writes by buffering in memory
2. **Indexed Queries**: All analytics queries use optimized indexes
3. **Aggregated Data**: Frontend receives pre-aggregated data, not raw logs
4. **Auto-refresh**: Charts update automatically without user action
5. **Time-based Cleanup**: Consider adding a cron job to archive old logs

## Recommended Next Steps

1. **Add Data Retention Policy**:
   - Archive logs older than 90 days
   - Create summary tables for historical data

2. **Add More Metrics**:
   - Database query performance
   - Memory usage
   - CPU utilization
   - Active user sessions

3. **Add Alerting**:
   - Email alerts for high error rates
   - Slack notifications for performance degradation
   - Dashboard warnings for anomalies

4. **Add Export Functionality**:
   - CSV export of analytics data
   - PDF reports generation
   - Scheduled email reports

5. **Add User Activity Heatmap**:
   - Show peak usage hours
   - Geographic distribution of users
   - Feature usage patterns

## Troubleshooting

### No data showing in charts

**Check 1**: Verify database table exists
```bash
mysql -u root -p
USE opticonnectgis_db;
SHOW TABLES LIKE 'api_performance_logs';
```

**Check 2**: Verify middleware is running
- Look for console logs when making API requests
- Check server.js includes performanceMiddleware

**Check 3**: Make some API calls
- The table will be empty until API calls are logged
- Try refreshing the page or clicking around the app

### Import errors in frontend

**Solution**: The chart components use named export from apiService:
```typescript
// Correct import
import apiService from '../../services/apiService';

// If that doesn't work, try:
import { apiService } from '../../services/apiService';
```

### Charts not updating

**Check**: Verify auto-refresh is working
- APILatencyChart refreshes every 60 seconds
- UsageTrendsChart refreshes every 5 minutes
- Try manually changing the time range selector

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  AnalyticsPage  │
│  ┌───────────┐  │
│  │ Latency   │  │──┐
│  │ Chart     │  │  │
│  └───────────┘  │  │
│  ┌───────────┐  │  │
│  │ Usage     │  │  │
│  │ Chart     │  │  │
│  └───────────┘  │  │
└─────────────────┘  │
                     │ HTTP GET /api/analytics/*
                     ▼
┌─────────────────────────────────┐
│         Backend Express         │
│  ┌───────────────────────────┐  │
│  │  Analytics Controller     │  │
│  │  - getPerformanceMetrics  │  │
│  │  - getUsageTrends         │  │
│  │  - getSystemHealth        │  │
│  └───────────────────────────┘  │
│         ▲              ▲         │
│         │              │         │
│   ┌─────┴──────┐  ┌───┴──────┐  │
│   │Performance │  │ MySQL    │  │
│   │Middleware  │  │Database  │  │
│   └────────────┘  └──────────┘  │
└─────────────────────────────────┘
```

## Files Created/Modified

### Backend:
- ✅ `src/middleware/performanceTracking.js` - Performance tracking middleware
- ✅ `migrations/create_api_performance_logs.sql` - Database schema
- ✅ `run-performance-migration.js` - Migration runner script
- ✅ `src/controllers/analyticsController.js` - Added 4 new endpoints (performance, usage-trends, system-health, recent-activity)
- ✅ `src/routes/analytics.routes.js` - Added new routes
- ✅ `server.js` - Integrated performance middleware (line 40-41)

### Frontend:
- ✅ `src/components/analytics/APILatencyChart.tsx` - Performance visualization
- ✅ `src/components/analytics/UsageTrendsChart.tsx` - Usage trends visualization
- ✅ `src/pages/AnalyticsPage.tsx` - Enhanced analytics page with tabs
- ✅ `src/components/dashboard/DashboardLayout.tsx` - Integrated real-time recent activity

## Conclusion

The Analytics Dashboard now provides comprehensive insights into:
- ✅ Real-time API performance
- ✅ Request latency and throughput
- ✅ Error rates and success metrics
- ✅ Feature usage trends over time
- ✅ System health monitoring (admin only)
- ✅ Recent user activity with role-based filtering

All data is pulled from the backend database, visualized with Recharts, and updates automatically!

### Recent Activity Features:
- **Admin/Manager Access**: View all user activities across the system plus their own
- **User Access**: View only their own activities
- **Activity Types Tracked**:
  - Distance Measurements
  - Polygon Drawings
  - Infrastructure Items
  - Circle Drawings
  - RF Sector Data
- **Color-Coded Indicators**: Different colors for each activity type
- **Relative Timestamps**: "2 minutes ago", "1 hour ago", etc.
- **Auto-Refresh**: Updates automatically with dashboard refresh
