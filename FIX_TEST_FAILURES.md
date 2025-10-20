# 🔧 Fix Test Failures

## Current Status

✅ **12 tests passing** (80% success rate)
❌ **3 tests failing:**
1. Login user (401 error) - **FIXED IN CODE**
2. Create group (500 error) - **NEEDS INVESTIGATION**
3. Get all groups (500 error) - **NEEDS INVESTIGATION**

---

## Problem 1: Port Already in Use ✅ SOLVED

**Error:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
You need to stop the other Node.js process that's using port 5000.

### Windows Command Prompt:
```cmd
# Find the process
netstat -ano | findstr :5000

# Kill it (replace PID with the number you see)
taskkill /PID <PID> /F
```

### OR Restart Your Computer
Simplest solution - restart your PC and try again.

---

## Problem 2: Login Test Fixed ✅

**Issue:** Email mismatch - test was using wrong email format
**Status:** Fixed in `test-apis.js`
**What changed:** Now stores `testUserEmail` variable to use same email for login

---

## Problem 3: Group Tests Failing ❌

**Errors:**
```
❌ FAIL: ✅ Create group with owner_id & is_public
❌   Error: Request failed with status code 500
❌   Response: {"success":false,"error":"Failed to create group"}
```

**Possible Causes:**

### A. Database Column Missing
Check if `groups` table has `is_public` column:

```sql
USE opticonnectgis_db;
SHOW COLUMNS FROM groups;
```

**Should see:**
```
owner_id
is_public  ← This must exist
```

**If `is_public` is missing:**
```sql
ALTER TABLE groups ADD COLUMN is_public BOOLEAN DEFAULT false;
```

### B. Foreign Key Constraint
The `group_members` table might have a strict foreign key that prevents insertion.

**Check constraints:**
```sql
SHOW CREATE TABLE group_members;
```

**If there's an issue, temporarily disable and re-enable:**
```sql
SET FOREIGN_KEY_CHECKS=0;
-- Run your tests
SET FOREIGN_KEY_CHECKS=1;
```

### C. Check Server Logs
The server logs will show the actual MySQL error. When you run `npm run dev`, watch for error messages when the test runs.

**What to look for:**
- `ER_NO_SUCH_TABLE` - Table doesn't exist
- `ER_BAD_FIELD_ERROR` - Column doesn't exist
- `ER_NO_REFERENCED_ROW` - Foreign key issue

---

## Step-by-Step Fix Process

### Step 1: Stop All Node Processes

**Option A: Windows Task Manager**
1. Press Ctrl+Shift+Esc
2. Find all "Node.js" processes
3. Right-click → End Task on each

**Option B: Command Line**
```cmd
taskkill /IM node.exe /F
```

### Step 2: Verify Database Schema

```bash
node verify-schema.js
```

**Expected:**
```
✅ Table 'groups' - All critical columns present
✅ Table 'group_members' - All critical columns present
```

**If fails:**
```sql
-- Run this in MySQL Workbench
USE opticonnectgis_db;

-- Check groups table
SHOW COLUMNS FROM groups;

-- Check group_members table
SHOW COLUMNS FROM group_members;

-- If is_public missing:
ALTER TABLE groups ADD COLUMN is_public BOOLEAN DEFAULT false AFTER is_active;

-- If owner_id missing:
ALTER TABLE groups ADD COLUMN owner_id INT;
```

### Step 3: Start Clean Server

```bash
# Make sure all node processes are stopped first!
cd C:\Users\hkcha\OneDrive\Desktop\OptiConnect\OptiConnect-Backend
npm run dev
```

**Watch for these messages:**
```
✅ All routes loaded successfully
✅ MySQL Database Connected Successfully!
📊 Database: opticonnectgis_db
✅ Server running on port 5000
```

**If you see port error, repeat Step 1**

### Step 4: Run Tests in New Terminal

```bash
# Open NEW PowerShell terminal (don't close server)
cd C:\Users\hkcha\OneDrive\Desktop\OptiConnect\OptiConnect-Backend
npm test
```

### Step 5: Watch Server Terminal

While tests run, watch the terminal running `npm run dev`. Any 500 errors will show detailed MySQL errors there.

**Example:**
```
Create group error: Error: ER_BAD_FIELD_ERROR: Unknown column 'is_public' in 'field list'
```

This tells you exactly what's wrong!

---

## Quick Diagnostic Checklist

Run these commands to diagnose:

### 1. Check Database Structure
```bash
node verify-schema.js
```

### 2. Test Database Connection
```bash
node -e "const {pool} = require('./src/config/database'); pool.query('SELECT 1').then(() => console.log('✅ DB OK')).catch(e => console.log('❌', e.message))"
```

### 3. Check Groups Table
```sql
-- In MySQL Workbench
USE opticonnectgis_db;
DESCRIBE groups;
```

**Must have these columns:**
- id
- name
- description
- owner_id ← Check this
- is_public ← Check this
- is_active
- created_at
- updated_at

### 4. Check Group Members Table
```sql
DESCRIBE group_members;
```

**Must have these columns:**
- id
- group_id
- user_id
- role
- added_by
- joined_at
- created_at

---

## Expected Test Results After Fix

```
========================================
🧪 OPTICONNECT API AUTOMATED TESTING
========================================

📁 1. AUTHENTICATION TESTS
────────────────────────────────────────
✅ PASS: Register new user
✅ PASS: Login user              ← Should now pass
✅ PASS: Get current user

📁 2. GROUPS TESTS (Schema Fixed)
────────────────────────────────────────
✅ PASS: ✅ Create group with owner_id & is_public  ← Should now pass
✅ PASS: Get all groups          ← Should now pass

... (all other tests passing)

Total Tests: 15
✅ Passed: 15
✅ Failed: 0
Success Rate: 100.00%

🎉 ALL TESTS PASSED!
```

---

## If Tests Still Fail

### Get Detailed Error Info

1. **Check server terminal** for actual MySQL error
2. **Run single test manually:**

```bash
# Start server
npm run dev

# In another terminal, test create group manually:
curl -X POST http://localhost:5000/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"name":"Test Group","is_public":false}'
```

3. **Test in Thunder Client:**
   - Open Thunder Client
   - Import collection
   - Run "Register User" first
   - Then run "Create Group"
   - See detailed error response

---

## Most Likely Solution

Based on your test output, the most likely issue is:

**The `groups` table is missing the `is_public` column**

**Quick Fix:**
```sql
USE opticonnectgis_db;
ALTER TABLE groups ADD COLUMN is_public BOOLEAN DEFAULT false;
```

Then rerun tests:
```bash
npm test
```

---

## Updated Test Script

✅ **Already fixed** `test-apis.js` to use correct email for login test.

Changes made:
- Added `testUserEmail` variable
- Store email during registration
- Use same email for login

**This fix is already in your `test-apis.js` file!**

---

## Action Plan

1. ⏸️  **Stop all Node processes** (Task Manager or `taskkill /IM node.exe /F`)
2. 🔍 **Check database:** `node verify-schema.js`
3. 🔧 **Fix any missing columns** (likely `is_public`)
4. ▶️  **Start server:** `npm run dev`
5. 🧪 **Run tests:** `npm test` (in new terminal)
6. 👀 **Watch server logs** for any 500 errors

---

## Need More Help?

Share the following information:

1. **Output of `node verify-schema.js`**
2. **Server terminal output when test fails** (shows actual MySQL error)
3. **Output of `SHOW COLUMNS FROM groups;` in MySQL**

With this info, I can give you the exact SQL command to fix the issue!

---

**Status:** Login test fixed ✅ | Group tests need investigation ⏳
**Next Step:** Run `node verify-schema.js` and check for `is_public` column
