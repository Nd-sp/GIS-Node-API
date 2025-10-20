# Quick Test Guide for Reports & Audit Logs

## Prerequisites

1. **Restart the backend server** to load new routes:
```bash
# Stop current server (Ctrl+C)
# Start again
npm start
```

2. **Login as Admin** to get authentication token

## Test Audit Logs

### Clear All Logs (Admin Only)

**PowerShell**:
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
Invoke-RestMethod -Uri "http://localhost:5005/api/audit/logs" -Method DELETE -Headers @{ Authorization = "Bearer $token" }
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Cleared X audit log(s) successfully",
  "deletedCount": X
}
```

## Test Reports

### 1. Region Usage Report

**JSON Format**:
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
Invoke-RestMethod -Uri "http://localhost:5005/api/reports/region-usage?format=json" -Headers @{ Authorization = "Bearer $token" }
```

**CSV Format** (Download):
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/region-usage?format=csv" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "region_usage.csv"
```

**XLSX Format** (Download):
```powershell
$token = "YOUR_JWT_TOKEN_HERE"
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/region-usage?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "region_usage.xlsx"
```

### 2. User Activity Report

```powershell
# JSON
Invoke-RestMethod -Uri "http://localhost:5005/api/reports/user-activity?format=json" -Headers @{ Authorization = "Bearer $token" }

# CSV Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/user-activity?format=csv" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "user_activity.csv"

# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/user-activity?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "user_activity.xlsx"
```

### 3. Audit Logs Report

```powershell
# JSON (last 1000 entries)
Invoke-RestMethod -Uri "http://localhost:5005/api/reports/audit-logs?format=json&limit=1000" -Headers @{ Authorization = "Bearer $token" }

# CSV Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/audit-logs?format=csv" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "audit_logs.csv"

# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/audit-logs?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "audit_logs.xlsx"
```

### 4. Temporary Access Report

```powershell
# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/temporary-access?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "temporary_access.xlsx"
```

### 5. Region Requests Report

```powershell
# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/region-requests?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "region_requests.xlsx"
```

### 6. Zone Assignments Report

```powershell
# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/zone-assignments?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "zone_assignments.xlsx"
```

### 7. Access Denials Report

```powershell
# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/access-denials?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "access_denials.xlsx"
```

### 8. Comprehensive Report

```powershell
# XLSX Download
Invoke-WebRequest -Uri "http://localhost:5005/api/reports/comprehensive?format=xlsx" `
  -Headers @{ Authorization = "Bearer $token" } `
  -OutFile "comprehensive_report.xlsx"
```

## Test All Reports at Once

```powershell
$token = "YOUR_JWT_TOKEN_HERE"
$baseUrl = "http://localhost:5005/api/reports"

# Download all reports as XLSX
$reports = @(
  "region-usage",
  "user-activity",
  "access-denials",
  "audit-logs",
  "temporary-access",
  "region-requests",
  "zone-assignments",
  "comprehensive"
)

foreach ($report in $reports) {
  Write-Host "Downloading $report report..."
  Invoke-WebRequest -Uri "$baseUrl/$report?format=xlsx" `
    -Headers @{ Authorization = "Bearer $token" } `
    -OutFile "${report}_$(Get-Date -Format 'yyyy-MM-dd').xlsx"
  Write-Host "✅ Downloaded: ${report}.xlsx"
}

Write-Host "`n✨ All reports downloaded successfully!"
```

## Expected File Locations

All downloaded files will be in your current directory:
```
region_usage_2025-10-14.xlsx
user_activity_2025-10-14.xlsx
audit_logs_2025-10-14.xlsx
temporary_access_2025-10-14.xlsx
region_requests_2025-10-14.xlsx
zone_assignments_2025-10-14.xlsx
access_denials_2025-10-14.xlsx
comprehensive_report_2025-10-14.xlsx
```

## Troubleshooting

### Error: 403 Forbidden
- **Cause**: Not logged in as admin
- **Solution**: Login with admin credentials

### Error: 401 Unauthorized
- **Cause**: Token expired or invalid
- **Solution**: Login again to get new token

### Error: 500 Internal Server Error
- **Cause**: Database issue or missing data
- **Solution**: Check backend console logs for details

### Error: Routes not found (404)
- **Cause**: Server not restarted after adding new routes
- **Solution**: Restart the backend server

## Verify Routes Loaded

Check backend console output when starting:
```
✅ All routes loaded successfully
```

If you see route loading errors, check the routes files for syntax errors.

## Frontend Testing

Once backend is working, test from the frontend:

1. Login as admin
2. Navigate to: **Admin Panel → Export Reports**
3. Select report type
4. Choose format (CSV/JSON/XLSX)
5. Click "Export Report"
6. File should download automatically

---

## Quick Reference

| Report Type | Endpoint | Best Format |
|-------------|----------|-------------|
| Region Usage | `/region-usage` | XLSX |
| User Activity | `/user-activity` | XLSX |
| Access Denials | `/access-denials` | XLSX |
| Audit Logs | `/audit-logs` | XLSX/CSV |
| Temporary Access | `/temporary-access` | XLSX |
| Region Requests | `/region-requests` | XLSX |
| Zone Assignments | `/zone-assignments` | XLSX |
| Comprehensive | `/comprehensive` | XLSX |

**Tip**: XLSX format is recommended for most reports as it preserves formatting and is easier to work with in Excel.

---

**Last Updated**: 2025-10-14
