# PersonalGIS Backend Server

Backend API server for PersonalGIS Platform with MySQL database.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Installation

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment Variables**

   Copy `.env.example` to `.env` and update with your values:
   ```bash
   cp .env.example .env
   ```

   Update the following in `.env`:
   ```
   DB_PASSWORD=your_actual_mysql_password
   JWT_SECRET=your_secret_key_here
   ```

3. **Ensure MySQL Database is Running**

   Make sure your MySQL database `personalgis_db` is created with all 25 tables.

4. **Start the Server**

   Development mode (with auto-reload):
   ```bash
   npm run dev
   ```

   Production mode:
   ```bash
   npm start
   ```

### First Time Setup

After starting the server, you should see:
```
✅ MySQL Database Connected Successfully!
🚀 PersonalGIS Backend Server Started Successfully!
📡 Server: http://localhost:5000
```

## 📡 API Testing

### Test Server is Running
```bash
curl http://localhost:5000/
```

Expected response:
```json
{
  "success": true,
  "message": "🚀 PersonalGIS Backend API is running!",
  "version": "1.0.0"
}
```

### Test Authentication

#### 1. Register a User
```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "full_name": "Test User",
  "role": "viewer"
}
```

#### 2. Login
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

Response will include a `token` - save this for subsequent requests.

#### 3. Get Current User
```bash
GET http://localhost:5000/api/auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📚 API Endpoints

### Authentication (`/api/auth`)
- `POST /login` - Login user
- `POST /register` - Register new user
- `GET /me` - Get current user
- `POST /change-password` - Change password
- `POST /logout` - Logout user

### Users (`/api/users`)
- Coming soon...

### Regions (`/api/regions`)
- Coming soon...

### GIS Tools
- Distance Measurements (`/api/measurements/distance`)
- Polygon Drawings (`/api/drawings/polygon`)
- Circle Drawings (`/api/drawings/circle`)
- Sector RF (`/api/rf/sectors`)
- Elevation Profiles (`/api/elevation`)
- Infrastructure (`/api/infrastructure`)

## 🛠️ Development

### Project Structure
```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MySQL connection
│   ├── controllers/
│   │   └── authController.js    # Auth logic
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   └── errorHandler.js      # Error handling
│   ├── routes/
│   │   └── auth.routes.js       # Auth routes
│   └── utils/
│       ├── jwt.js               # JWT utilities
│       └── bcrypt.js            # Password hashing
├── .env                         # Environment variables
├── server.js                    # Server entry point
└── package.json
```

### Adding New Routes

1. Create controller in `src/controllers/`
2. Create route file in `src/routes/`
3. Import and use in `server.js`

Example:
```javascript
// In server.js
const myRoutes = require('./src/routes/my.routes');
app.use('/api/my-endpoint', myRoutes);
```

## 🐛 Troubleshooting

### Database Connection Failed
- Check MySQL is running
- Verify DB_PASSWORD in .env
- Ensure database `personalgis_db` exists
- Check all 25 tables are created

### Port Already in Use
Change PORT in `.env`:
```
PORT=5001
```

### JWT Token Errors
- Check JWT_SECRET is set in .env
- Ensure token is in format: `Bearer YOUR_TOKEN`

## 📞 Support

For issues or questions, check the main project documentation.

## 🎯 Next Steps

1. Test authentication APIs
2. Create remaining API endpoints
3. Test with Postman or Thunder Client
4. Connect frontend to backend

## 📄 License

ISC
