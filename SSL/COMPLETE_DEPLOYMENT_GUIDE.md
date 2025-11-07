# OptiConnect Backend - Complete Deployment Guide

**Everything you need to deploy OptiConnect Backend in ONE document.**

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [SSL/HTTPS Setup](#ssl-https-setup)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start {#quick-start}

**3 Simple Steps to Deploy:**

### Step 1: Upload Files
Upload entire `Backend` folder to Server VM at:
```
C:\inetpub\wwwroot\opticonnect-backend\
```

### Step 2: Install Dependencies
On Server VM, open PowerShell as Administrator:
```powershell
cd C:\inetpub\wwwroot\opticonnect-backend
npm install
```

### Step 3: Configure IIS
Follow [IIS Configuration](#configure-iis) section below.

**Test:** http://172.16.20.6:82/api/health

✅ **Done!** Backend is running.

---

## ⚙️ Prerequisites {#prerequisites}

### On Server VM, you need:

1. **Windows Server** (any recent version)

2. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

3. **npm** (comes with Node.js)
   - Verify: `npm --version`

4. **IIS (Internet Information Services)**
   - Enable via: Server Manager → Add Roles and Features → Web Server (IIS)

5. **iisnode module for IIS**
   - Download: https://github.com/Azure/iisnode/releases
   - Install x64 version

6. **URL Rewrite Module for IIS**
   - Download: https://www.iis.net/downloads/microsoft/url-rewrite

7. **MySQL Server**
   - Must be running on `172.16.20.6:3306`
   - Database `opticonnectgis_db` must exist

### Check Prerequisites

```powershell
# Check Node.js
node --version

# Check npm
npm --version

# Check IIS
Get-WindowsFeature -Name Web-Server

# Check MySQL connection
mysql -h 172.16.20.6 -u root -p
```

---

## 📦 Deployment Steps {#deployment-steps}

### Step 1: Upload Files to Server VM

**Upload Location:**
```
C:\inetpub\wwwroot\opticonnect-backend\
```

**Files to upload:**
- All files from Backend folder
- Including: `server.js`, `package.json`, `web.config`, `.env`, `src/`, etc.

### Step 2: Install Node.js Dependencies

```powershell
# Open PowerShell as Administrator
cd C:\inetpub\wwwroot\opticonnect-backend

# Install dependencies
npm install
```

**Expected:** Creates `node_modules` folder with all packages.

### Step 3: Test Database Connection

```powershell
# Test database connectivity
npm run check-db
```

**Expected Output:**
```
✅ MySQL Database Connected Successfully!
📊 Database: opticonnectgis_db
```

**If connection fails:**
- Check MySQL is running on 172.16.20.6:3306
- Verify credentials in `.env` file
- Check firewall allows port 3306

### Step 4: Configure IIS {#configure-iis}

#### 4a. Create Application Pool

1. Open IIS Manager: `Win + R` → `inetmgr`
2. Right-click "Application Pools" → "Add Application Pool"
3. Settings:
   - Name: `OptiConnectBackend`
   - .NET CLR Version: `No Managed Code`
4. Click OK

#### 4b. Configure Application Pool

1. Select `OptiConnectBackend` pool
2. Click "Advanced Settings"
3. Set:
   - Enable 32-Bit Applications: `False`
   - Identity: `NetworkService` (or appropriate account)
4. Click OK

#### 4c. Create Website

1. Right-click "Sites" → "Add Website"
2. Settings:
   - Site name: `OptiConnect Backend`
   - Application pool: `OptiConnectBackend`
   - Physical path: `C:\inetpub\wwwroot\opticonnect-backend`
   - Binding:
     - Type: `http`
     - IP address: `172.16.20.6`
     - Port: `82`
3. Click OK

#### 4d. Set Folder Permissions

```powershell
# Add IIS users to backend folder
icacls "C:\inetpub\wwwroot\opticonnect-backend" /grant "IIS_IUSRS:(OI)(CI)RX"
icacls "C:\inetpub\wwwroot\opticonnect-backend" /grant "IUSR:(OI)(CI)RX"
```

Or manually:
1. Right-click backend folder → Properties → Security
2. Add `IIS_IUSRS` and `IUSR` with Read & Execute permissions

#### 4e. Start Website

1. In IIS Manager, select "OptiConnect Backend" site
2. Click "Start" in Actions panel
3. Status should show "Started"

### Step 5: Configure Firewall

```powershell
# Open port 82 for HTTP
New-NetFirewallRule `
    -DisplayName "OptiConnect HTTP" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 82 `
    -Action Allow
```

### Step 6: Test Deployment

**Open browser:**
```
http://172.16.20.6:82/
```

**Expected Response:**
```json
{
  "success": true,
  "message": "🚀 OptiConnectGIS Backend API is running!",
  "version": "1.0.0"
}
```

**Test Health Check:**
```
http://172.16.20.6:82/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "status": "healthy",
  "database": {
    "status": "connected"
  }
}
```

✅ **Backend is deployed!**

---

## 🔒 SSL/HTTPS Setup {#ssl-https-setup}

**Optional but recommended** - Adds encryption to your backend.

### Do You Need SSL?

| Scenario | SSL Needed? |
|----------|------------|
| Testing/development | Optional |
| Production environment | ✅ Recommended |
| Sensitive data | ✅ Required |
| External access | ✅ Recommended |

### Which Option?

| Current Setup | Use This |
|--------------|----------|
| IP address (172.16.20.6) | **Self-Signed Certificate** |
| Have domain name | **Let's Encrypt Certificate** |

---

### Option 1: Self-Signed Certificate (For IP)

**Use NOW** - Works with IP 172.16.20.6

#### Automated Installation (5 minutes)

```powershell
# On Server VM, PowerShell as Administrator
cd C:\inetpub\wwwroot\opticonnect-backend
.\Install-SelfSignedSSL.ps1
```

**What it does:**
- ✅ Creates SSL certificate (valid 5 years)
- ✅ Adds HTTPS binding to IIS (port 443)
- ✅ Opens firewall port 443
- ✅ Exports certificate for client installation
- ✅ Tests configuration

**Result:** HTTPS works at `https://172.16.20.6`

**Browser Warning:** ⚠️ Users will see security warning (normal for self-signed)
- Click "Advanced" → "Proceed to site"
- Or install certificate on client machines (script exports to `C:\OptiConnect-SSL-Certificate.cer`)

---

### Option 2: Let's Encrypt Certificate (For Domain)

**Use LATER** - After purchasing domain

#### Prerequisites:
- ✅ Domain name registered (e.g., opticonnect.yourdomain.com)
- ✅ DNS A record pointing to server's PUBLIC IP
- ✅ Ports 80 and 443 accessible from internet
- ✅ Valid email address

#### Automated Installation (15 minutes)

```powershell
# On Server VM, PowerShell as Administrator
cd C:\inetpub\wwwroot\opticonnect-backend
.\Install-LetsEncryptSSL.ps1
```

**Script will ask:**
- Domain name: `opticonnect.yourdomain.com`
- Email: `your-email@domain.com`

**What it does:**
- ✅ Downloads Win-ACME (Let's Encrypt client)
- ✅ Requests trusted certificate from Let's Encrypt
- ✅ Installs certificate in IIS
- ✅ Sets up auto-renewal (every 60 days)
- ✅ Tests configuration

**Result:** HTTPS works at `https://opticonnect.yourdomain.com`

**Browser Warning:** ✅ No warnings! Fully trusted.

---

### Activate HTTPS

After installing certificate:

#### 1. Update .env File

```powershell
# Use pre-configured SSL environment
Copy-Item ".env.ssl" ".env" -Force
```

Or manually edit `.env`:
```env
# For Self-Signed (IP):
FRONTEND_URL=https://172.16.20.6:81
APP_URL=https://172.16.20.6:81

# For Let's Encrypt (Domain):
FRONTEND_URL=https://yourdomain.com
APP_URL=https://yourdomain.com
```

#### 2. Enable HTTPS Redirect

Edit `web.config`, find line ~19, **uncomment:**

```xml
<rule name="HTTP to HTTPS Redirect" stopProcessing="true">
  <match url="(.*)" />
  <conditions>
    <add input="{HTTPS}" pattern="off" ignoreCase="true" />
  </conditions>
  <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
</rule>
```

#### 3. Enable HSTS Header (Optional)

Edit `web.config`, find line ~95, **uncomment:**

```xml
<add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
```

#### 4. Restart IIS

```powershell
iisreset
```

#### 5. Test HTTPS

```
https://172.16.20.6/api/health
```

or

```
https://yourdomain.com/api/health
```

✅ **HTTPS is active!**

**For detailed SSL setup:** See `SSL_COMPLETE_GUIDE.md`

---

## ⚙️ Configuration {#configuration}

### Environment Variables (.env)

Current production settings (already configured):

```env
# Database
DB_HOST=172.16.20.6
DB_USER=root
DB_PASSWORD=Karma@1107
DB_NAME=opticonnectgis_db
DB_PORT=3306

# JWT (synchronized across all configs)
JWT_SECRET=2LNI6aVWG3CDaEe8MCaygTZsNXjL4JDnCC5rqBxfXwV1BXxqNciC67n9iqJm8nr6GT8ZK9HHaJskgulHw1OU6w==
JWT_EXPIRE=2h
JWT_REFRESH_EXPIRE=7d

# Server
PORT=82
NODE_ENV=production

# Frontend
FRONTEND_URL=http://172.16.20.6:81

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=optimaltelemedia.verify.mail@gmail.com
EMAIL_PASSWORD=fdgrwbowvbdrvkug
```

**No changes needed!** ✅

### IIS Configuration (web.config)

Already configured for production:
- ✅ iisnode handler
- ✅ URL rewriting
- ✅ 100MB file upload limit
- ✅ Security headers
- ✅ HTTPS redirect (commented - activate when SSL ready)

**No changes needed!** ✅

---

## 🧪 Testing {#testing}

### Test Checklist

**Basic Tests:**
- [ ] Root endpoint responds: `http://172.16.20.6:82/`
- [ ] Health check works: `http://172.16.20.6:82/api/health`
- [ ] Database shows "connected"
- [ ] No errors in browser console

**API Tests:**
- [ ] User login works
- [ ] Authentication token returned
- [ ] Protected endpoints require token
- [ ] CORS allows frontend communication

**File Tests:**
- [ ] iisnode logs created in `iisnode/` folder
- [ ] No error logs (check `*-stderr-*.txt` files)
- [ ] IIS logs created in `C:\inetpub\logs\LogFiles\`

**Network Tests:**
```powershell
# Test port 82 is listening
netstat -an | findstr ":82"

# Test from another machine
Test-NetConnection -ComputerName 172.16.20.6 -Port 82
```

### Test Commands

```powershell
# Health check
Invoke-WebRequest -Uri "http://172.16.20.6:82/api/health"

# Login test
$body = @{
    email = "admin@example.com"
    password = "password123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://172.16.20.6:82/api/auth/login" -Method POST -Body $body -ContentType "application/json"
```

---

## 🐛 Troubleshooting {#troubleshooting}

### Issue 1: "HTTP Error 500.1001 - Internal Server Error"

**Cause:** iisnode not installed or configured

**Solution:**
1. Install iisnode module
2. Restart IIS: `iisreset`
3. Verify `web.config` exists in backend folder

---

### Issue 2: "Database Connection Failed"

**Cause:** Cannot connect to MySQL

**Solution:**
```powershell
# Test MySQL connection
mysql -h 172.16.20.6 -u root -p

# Check MySQL service
Get-Service -Name MySQL*

# Check .env credentials
cat .env | findstr DB_
```

---

### Issue 3: "Cannot GET /api/..."

**Cause:** URL Rewrite not working

**Solution:**
1. Install URL Rewrite module
2. Verify `web.config` has rewrite rules
3. Restart IIS: `iisreset`

---

### Issue 4: "Module not found" errors

**Cause:** node_modules not installed

**Solution:**
```powershell
cd C:\inetpub\wwwroot\opticonnect-backend
npm install
```

---

### Issue 5: CORS errors from frontend

**Cause:** Frontend URL mismatch

**Solution:**
1. Check `FRONTEND_URL` in `.env`
2. Should be: `http://172.16.20.6:81` (or your frontend URL)
3. Restart IIS application pool

---

### Issue 6: "Access Denied" or Permission Errors

**Cause:** IIS users don't have folder permissions

**Solution:**
```powershell
icacls "C:\inetpub\wwwroot\opticonnect-backend" /grant "IIS_IUSRS:(OI)(CI)RX"
icacls "C:\inetpub\wwwroot\opticonnect-backend" /grant "IUSR:(OI)(CI)RX"
```

---

### Issue 7: Port 82 already in use

**Cause:** Another application using port 82

**Solution:**
```powershell
# Check what's using port 82
netstat -ano | findstr ":82"

# Change to different port in IIS binding (e.g., 8082)
# Update .env: PORT=8082
```

---

### Check Logs

**Application Logs:**
```
C:\inetpub\wwwroot\opticonnect-backend\iisnode\*.txt
```

**IIS Logs:**
```
C:\inetpub\logs\LogFiles\
```

**Windows Event Viewer:**
- Press `Win + R` → `eventvwr`
- Windows Logs → Application
- Look for iisnode or W3SVC errors

---

## ✅ Success Checklist

### Deployment Complete When:

- [ ] Files uploaded to Server VM
- [ ] `npm install` completed successfully
- [ ] Database connection test passes
- [ ] IIS site created and started
- [ ] Firewall configured for port 82
- [ ] Health check returns "healthy" status
- [ ] Frontend can communicate with backend
- [ ] Login/authentication works
- [ ] No errors in iisnode logs
- [ ] No errors in Windows Event Viewer

### Optional: SSL/HTTPS Complete When:

- [ ] SSL certificate installed
- [ ] HTTPS binding exists in IIS (port 443)
- [ ] Firewall configured for port 443
- [ ] `.env` updated with HTTPS URLs
- [ ] HTTPS redirect enabled in `web.config`
- [ ] HTTPS health check works
- [ ] HTTP automatically redirects to HTTPS
- [ ] No mixed content warnings

---

## 📞 Quick Commands Reference

```powershell
# Navigate to backend
cd C:\inetpub\wwwroot\opticonnect-backend

# Install dependencies
npm install

# Test database
npm run check-db

# Restart IIS
iisreset

# Restart app pool only
Restart-WebAppPool -Name "OptiConnectBackend"

# Check if port 82 is listening
netstat -an | findstr ":82"

# Test health check
Invoke-WebRequest -Uri "http://172.16.20.6:82/api/health"

# View recent logs
Get-ChildItem ".\iisnode\*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 5

# Check IIS site status
Get-Website -Name "OptiConnect Backend"
```

---

## 🎯 Summary

**Your backend is production-ready!**

**Deployment:** 3 steps
1. Upload files → 2. npm install → 3. Configure IIS

**Time:** 30-60 minutes

**Optional SSL:** Add encryption with automated scripts
- Self-Signed: 5 minutes
- Let's Encrypt: 15 minutes

**Everything is configured** - No changes needed!

**Test URL:** http://172.16.20.6:82/api/health

---

**For detailed SSL setup, see:** `SSL_COMPLETE_GUIDE.md`

**Good luck with your deployment!** 🚀

---

*OptiConnect Backend - Complete Deployment Guide*
*Everything in one document!*
