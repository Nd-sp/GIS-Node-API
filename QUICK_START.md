# 🚀 QUICK START GUIDE

## Step-by-Step Instructions to Run Your Backend

### Step 1: Open Terminal in Backend Folder
```bash
cd C:\Users\hkcha\OneDrive\Desktop\PersonalGIS-Backend
```

### Step 2: Install Node.js Packages
```bash
npm install
```

This will install all required packages (express, mysql2, jsonwebtoken, bcrypt, etc.)

**Wait for installation to complete** (may take 2-3 minutes)

### Step 3: Update .env File

Open `.env` file and update:
```
DB_PASSWORD=YOUR_ACTUAL_MYSQL_PASSWORD
```

Replace `YOUR_ACTUAL_MYSQL_PASSWORD` with your real MySQL password.

### Step 4: Make Sure MySQL is Running

- Open MySQL Workbench or MySQL Command Line
- Verify database `personalgis_db` exists
- Verify all 25 tables are created

### Step 5: Start the Server

```bash
npm run dev
```

You should see:
```
✅ MySQL Database Connected Successfully!
🚀 PersonalGIS Backend Server Started Successfully!
📡 Server: http://localhost:5000
```

### Step 6: Test in Browser

Open browser and go to:
```
http://localhost:5000
```

You should see:
```json
{
  "success": true,
  "message": "🚀 PersonalGIS Backend API is running!",
  "version": "1.0.0"
}
```

## ✅ Your Backend is Running!

---

## 🧪 Test Your First API (Login)

### Option 1: Using Browser Extension (Thunder Client / Postman)

1. Install Thunder Client extension in VS Code (or use Postman)
2. Create new POST request
3. URL: `http://localhost:5000/api/auth/register`
4. Headers: `Content-Type: application/json`
5. Body (JSON):
```json
{
  "username": "admin",
  "email": "admin@opticonnect.com",
  "password": "admin123",
  "full_name": "Admin User",
  "role": "admin"
}
```
6. Click Send

You should get a response with a token!

### Option 2: Using curl (Command Line)

```bash
curl -X POST http://localhost:5000/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"email\":\"admin@opticonnect.com\",\"password\":\"admin123\",\"full_name\":\"Admin User\",\"role\":\"admin\"}"
```

---

## 🎯 What's Next?

1. ✅ Backend server is running
2. ✅ Authentication APIs work
3. ⏳ Next: Create more API controllers and routes
4. ⏳ Next: Connect frontend to backend

---

## ❌ Common Errors & Solutions

### Error: "Cannot find module 'express'"
**Solution:** Run `npm install` again

### Error: "MySQL Connection Failed"
**Solution:**
- Check MySQL is running
- Update DB_PASSWORD in .env file
- Verify database name is correct

### Error: "Port 5000 is already in use"
**Solution:**
- Change PORT in .env to 5001 or 5002
- Or stop the process using port 5000

### Error: "Table doesn't exist"
**Solution:**
- Check all 25 tables are created in MySQL
- Run table creation scripts again if needed

---

## 🔥 Keep Server Running

While developing:
- Keep server running with `npm run dev`
- It will auto-reload when you change files
- Check terminal for any errors
- Test APIs as you build them

---

## 📞 Need Help?

If you encounter any issues:
1. Check the error message in terminal
2. Verify MySQL is running
3. Check .env file values
4. Ask for help with specific error message

---

## 🎉 Congratulations!

Your backend server is now running and ready to handle API requests!

**Current Status:**
- ✅ Server running on http://localhost:5000
- ✅ MySQL database connected
- ✅ Authentication APIs working
- ⏳ Building remaining 100+ APIs

**Next Step:** I'll create more API controllers and routes for you!
