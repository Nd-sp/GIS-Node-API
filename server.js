const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { testConnection } = require("./src/config/database");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const { startCleanupScheduler } = require("./src/utils/temporaryAccessCleanup");
const { ensureTables } = require("./src/config/initTables");

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Support multiple origins
const allowedOrigins = [
  "http://localhost:3005",
  "http://172.16.20.6:81",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "X-Request-Time"],
    exposedHeaders: ["X-Request-ID", "X-Request-Time"]
  })
);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logger (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Performance tracking middleware
const { performanceMiddleware } = require("./src/middleware/performanceTracking");
app.use(performanceMiddleware);

// 🚀 COMPRESSION MIDDLEWARE - Reduces response size by 70-80%
const compressionMiddleware = require("./src/middleware/compression");
app.use(compressionMiddleware);

// 🚀 CACHE UTILITIES - For clearing cache after mutations
const { getCacheStats, clearAllCache } = require("./src/middleware/cache");

// Rate limiting - Industry standard (more permissive for development)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute (reduced window)
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 500 requests per minute
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for critical endpoints to prevent blocking during initial page load
    const skipPaths = [
      '/auth',
      '/temporary-access',
      '/users',
      '/datahub',
      '/measurements',
      '/drawings',
      '/rf',
      '/elevation',
      '/infrastructure',
      '/analytics',
      '/notifications',
      '/regions',
      '/search'
    ];
    // Check if request path starts with any skip path
    return skipPaths.some(path => req.path.startsWith(path));
  }
});
app.use("/api/", limiter);

// Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 OptiConnectGIS Backend API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API health check
app.get("/api/health", async (req, res) => {
  try {
    const { pool } = require("./src/config/database");

    // Test database connection
    let dbStatus = "connected";
    try {
      await pool.query('SELECT 1');
    } catch (err) {
      dbStatus = "disconnected";
    }

    res.json({
      success: true,
      status: "healthy",
      server: {
        name: "OptiConnectGIS Backend",
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      database: {
        status: dbStatus,
        name: process.env.DB_NAME || "opticonnectgis_db"
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message
    });
  }
});

// 🚀 CACHE STATS ENDPOINT - Monitor cache performance
app.get("/api/cache/stats", (req, res) => {
  const stats = getCacheStats();
  res.json({
    success: true,
    cache: stats
  });
});

// 🚀 CLEAR CACHE ENDPOINT - Clear all cache (admin only in production)
app.post("/api/cache/clear", (req, res) => {
  clearAllCache();
  res.json({
    success: true,
    message: "All cache cleared successfully"
  });
});

// Import and use routes
try {
  // Authentication routes
  const authRoutes = require("./src/routes/auth.routes");
  app.use("/api/auth", authRoutes);

  // User routes
  const userRoutes = require("./src/routes/user.routes");
  app.use("/api/users", userRoutes);

  // Region routes
  const regionRoutes = require("./src/routes/region.routes");
  app.use("/api/regions", regionRoutes);

  // Group routes
  const groupRoutes = require("./src/routes/group.routes");
  app.use("/api/groups", groupRoutes);

  // GIS Features routes
  const featureRoutes = require("./src/routes/feature.routes");
  app.use("/api/features", featureRoutes);

  // Distance Measurement routes
  const distanceRoutes = require("./src/routes/distanceMeasurement.routes");
  app.use("/api/measurements/distance", distanceRoutes);

  // Polygon Drawing routes
  const polygonRoutes = require("./src/routes/polygonDrawing.routes");
  app.use("/api/drawings/polygon", polygonRoutes);

  // Circle Drawing routes
  const circleRoutes = require("./src/routes/circleDrawing.routes");
  app.use("/api/drawings/circle", circleRoutes);

  // SectorRF routes
  const sectorRoutes = require("./src/routes/sectorRF.routes");
  app.use("/api/rf/sectors", sectorRoutes);

  // Elevation Profile routes
  const elevationRoutes = require("./src/routes/elevationProfile.routes");
  app.use("/api/elevation", elevationRoutes);

  // Building Cache routes (for LOS analysis)
  const buildingCacheRoutes = require("./src/routes/buildingCache.routes");
  app.use("/api/building-cache", buildingCacheRoutes);

  // Infrastructure routes
  const infrastructureRoutes = require("./src/routes/infrastructure.routes");
  app.use("/api/infrastructure", infrastructureRoutes);

  // Layer Management routes
  const layerRoutes = require("./src/routes/layerManagement.routes");
  app.use("/api/layers", layerRoutes);

  // Bookmark routes
  const bookmarkRoutes = require("./src/routes/bookmark.routes");
  app.use("/api/bookmarks", bookmarkRoutes);

  // Search routes
  const searchRoutes = require("./src/routes/search.routes");
  app.use("/api/search", searchRoutes);

  // Analytics routes
  const analyticsRoutes = require("./src/routes/analytics.routes");
  app.use("/api/analytics", analyticsRoutes);

  // Audit routes
  const auditRoutes = require("./src/routes/audit.routes");
  app.use("/api/audit", auditRoutes);

  // User Preferences routes
  const preferencesRoutes = require("./src/routes/preferences.routes");
  app.use("/api/preferences", preferencesRoutes);

  // Data Hub routes
  const dataHubRoutes = require("./src/routes/dataHub.routes");
  app.use("/api/datahub", dataHubRoutes);

  // Temporary Access routes
  const temporaryAccessRoutes = require("./src/routes/temporaryAccess.routes");
  app.use("/api/temporary-access", temporaryAccessRoutes);

  // Region Request routes
  const regionRequestRoutes = require("./src/routes/regionRequest.routes");
  app.use("/api/region-requests", regionRequestRoutes);

  // Permission routes
  const permissionRoutes = require("./src/routes/permission.routes");
  app.use("/api/permissions", permissionRoutes);

  // Reports routes
  const reportsRoutes = require("./src/routes/reports.routes");
  app.use("/api/reports", reportsRoutes);

  // User Map Preferences routes
  const userMapPreferencesRoutes = require("./src/routes/userMapPreferences.routes");
  app.use("/api/user-map-preferences", userMapPreferencesRoutes);

  // Search History routes
  const searchHistoryRoutes = require("./src/routes/searchHistory.routes");
  app.use("/api/search-history", searchHistoryRoutes);

  // Notification routes
  const notificationRoutes = require("./src/routes/notification.routes");
  app.use("/api/notifications", notificationRoutes);

  // Password Reset Request routes
  const passwordResetRequestRoutes = require("./src/routes/passwordResetRequest.routes");
  app.use("/api/password-reset-requests", passwordResetRequestRoutes);

  console.log("✅ All routes loaded successfully");
} catch (error) {
  console.warn("⚠️ Some routes not loaded yet:", error.message);
}

// 404 handler
app.use(notFound);

// Error handler middleware (must be last)
app.use(errorHandler);

// Server configuration
const PORT = process.env.PORT || 82;

// Start server
const startServer = async () => {
  try {
    // Test database connection first
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error(
        "Failed to connect to database. Please check your configuration."
      );
      process.exit(1);
    }

    // Ensure all database tables exist
    await ensureTables();

    // Start temporary access cleanup scheduler
    startCleanupScheduler();

    // Start Express server
    app.listen(PORT, () => {
      console.log("\n" + "=".repeat(60));
      console.log("🚀 PersonalGIS Backend Server Started Successfully!");
      console.log("=".repeat(60));
      console.log(`📡 Server: http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📊 Database: ${process.env.DB_NAME}`);
      console.log(`🔒 CORS Enabled: ${process.env.FRONTEND_URL}`);
      console.log("=".repeat(60) + "\n");
      console.log("📚 API Documentation: http://localhost:" + PORT + "/");
      console.log("💚 Health Check: http://localhost:" + PORT + "/api/health");
      console.log("\n🔥 Server is ready to accept requests!\n");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  process.exit(1);
});

// Start the server
startServer();

module.exports = app;
