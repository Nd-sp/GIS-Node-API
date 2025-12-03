const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// Load environment-specific configuration FIRST
const {
  env,
  isProduction,
  isDevelopment,
} = require("./src/config/environment");

const { testConnection } = require("./src/config/database");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const { startCleanupScheduler } = require("./src/utils/temporaryAccessCleanup");
const { ensureTables } = require("./src/config/initTables");
const websocketServer = require("./src/services/websocketServer");

// Initialize Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Security middleware
app.use(helmet());

// CORS configuration - Support multiple origins
const allowedOrigins = [
  "http://localhost:3005",
  "http://localhost:3000",
  "http://172.16.20.6:81", // Frontend
  "http://172.16.20.6:82", // Self/Backend (for some internal calls)
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`); // Log blocked origins for debugging
        // For strict production, use the error below.
        // For testing internal IPs which might vary slightly, you could temporarily allow all:
        // callback(null, true);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Request-Time",
    ],
    exposedHeaders: ["X-Request-ID", "X-Request-Time"],
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
const {
  performanceMiddleware,
} = require("./src/middleware/performanceTracking");
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
      "/auth",
      "/temporary-access",
      "/users",
      "/datahub",
      "/measurements",
      "/drawings",
      "/rf",
      "/fiber-rings",
      "/elevation",
      "/infrastructure",
      "/analytics",
      "/notifications",
      "/regions",
      "/search",
      "/user-map-preferences", // Map preferences for each user
      "/boundaries", // Region boundaries for map layers
    ];
    // Check if request path starts with any skip path (without /api/ prefix)
    return skipPaths.some((path) => req.path.startsWith(path));
  },
});
app.use("/api/", limiter);

// Health check route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 OptiConnectGIS Backend API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API health check
app.get("/api/health", async (req, res) => {
  try {
    const { pool } = require("./src/config/database");

    // Test database connection
    let dbStatus = "connected";
    try {
      await pool.query("SELECT 1");
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
        timestamp: new Date().toISOString(),
      },
      database: {
        status: dbStatus,
        name: process.env.DB_NAME || "opticonnectgis_db",
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message,
    });
  }
});

// 🚀 CACHE STATS ENDPOINT - Monitor cache performance
app.get("/api/cache/stats", (req, res) => {
  const stats = getCacheStats();
  res.json({
    success: true,
    cache: stats,
  });
});

// 🚀 CLEAR CACHE ENDPOINT - Clear all cache (admin only in production)
app.post("/api/cache/clear", (req, res) => {
  clearAllCache();
  res.json({
    success: true,
    message: "All cache cleared successfully",
  });
});

// Import and use routes - with individual error handling
const routes = [
  // Public routes (no auth) - Load these first
  { name: "auth", path: "./src/routes/auth.routes", mount: "/api/auth" },
  {
    name: "passwordResetRequests",
    path: "./src/routes/passwordResetRequest.routes",
    mount: "/api/password-reset-requests",
  },

  // Authenticated routes
  { name: "mfa", path: "./src/routes/mfaRoutes", mount: "/api/mfa" },
  { name: "users", path: "./src/routes/user.routes", mount: "/api/users" },
  {
    name: "regions",
    path: "./src/routes/region.routes",
    mount: "/api/regions",
  },
  {
    name: "boundaryVersions",
    path: "./src/routes/boundaryVersionRoutes",
    mount: "/api/regions",
  },
  {
    name: "boundaryPublic",
    path: "./src/routes/boundaryPublicRoutes",
    mount: "/api/boundaries",
  },
  { name: "groups", path: "./src/routes/group.routes", mount: "/api/groups" },
  {
    name: "features",
    path: "./src/routes/feature.routes",
    mount: "/api/features",
  },
  {
    name: "distance",
    path: "./src/routes/distanceMeasurement.routes",
    mount: "/api/measurements/distance",
  },
  {
    name: "polygon",
    path: "./src/routes/polygonDrawing.routes",
    mount: "/api/drawings/polygon",
  },
  {
    name: "circle",
    path: "./src/routes/circleDrawing.routes",
    mount: "/api/drawings/circle",
  },
  {
    name: "sectorRF",
    path: "./src/routes/sectorRF.routes",
    mount: "/api/rf/sectors",
  },
  {
    name: "elevation",
    path: "./src/routes/elevationProfile.routes",
    mount: "/api/elevation",
  },
  {
    name: "buildingCache",
    path: "./src/routes/buildingCache.routes",
    mount: "/api/building-cache",
  },
  {
    name: "infrastructure",
    path: "./src/routes/infrastructure.routes",
    mount: "/api/infrastructure",
  },
  {
    name: "layers",
    path: "./src/routes/layerManagement.routes",
    mount: "/api/layers",
  },
  {
    name: "bookmarks",
    path: "./src/routes/bookmark.routes",
    mount: "/api/bookmarks",
  },
  { name: "search", path: "./src/routes/search.routes", mount: "/api/search" },
  {
    name: "analytics",
    path: "./src/routes/analytics.routes",
    mount: "/api/analytics",
  },
  { name: "audit", path: "./src/routes/audit.routes", mount: "/api/audit" },
  {
    name: "preferences",
    path: "./src/routes/preferences.routes",
    mount: "/api/preferences",
  },
  {
    name: "datahub",
    path: "./src/routes/dataHub.routes",
    mount: "/api/datahub",
  },
  {
    name: "temporaryAccess",
    path: "./src/routes/temporaryAccess.routes",
    mount: "/api/temporary-access",
  },
  {
    name: "regionRequests",
    path: "./src/routes/regionRequest.routes",
    mount: "/api/region-requests",
  },
  {
    name: "permissions",
    path: "./src/routes/permission.routes",
    mount: "/api/permissions",
  },
  {
    name: "reports",
    path: "./src/routes/reports.routes",
    mount: "/api/reports",
  },
  {
    name: "userMapPreferences",
    path: "./src/routes/userMapPreferences.routes",
    mount: "/api/user-map-preferences",
  },
  {
    name: "searchHistory",
    path: "./src/routes/searchHistory.routes",
    mount: "/api/search-history",
  },
  {
    name: "notifications",
    path: "./src/routes/notification.routes",
    mount: "/api/notifications",
  },
  {
    name: "devTools",
    path: "./src/routes/devToolsRoutes",
    mount: "/api/dev-tools",
  },

  // Routes mounted at /api - Load these LAST to avoid intercepting specific routes
  {
    name: "groupPermissions",
    path: "./src/routes/groupPermission.routes",
    mount: "/api",
  },
  {
    name: "userPermissions",
    path: "./src/routes/userPermission.routes",
    mount: "/api",
  },
  { name: "fiberRings", path: "./src/routes/fiberRingRoutes", mount: "/api" },
];

let loadedCount = 0;
let failedRoutes = [];

routes.forEach(({ name, path, mount }) => {
  try {
    const routeModule = require(path);
    app.use(mount, routeModule);
    loadedCount++;
  } catch (error) {
    console.error(
      `❌ Failed to load ${name} routes (${mount}):`,
      error.message
    );
    failedRoutes.push({ name, mount, error: error.message });
  }
});

if (failedRoutes.length === 0) {
  console.log(`✅ All ${loadedCount} routes loaded successfully`);
} else {
  console.warn(
    `⚠️ ${loadedCount}/${routes.length} routes loaded. ${failedRoutes.length} failed:`
  );
  failedRoutes.forEach(({ name, mount, error }) => {
    console.warn(`   - ${name} (${mount}): ${error}`);
  });
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

    // Initialize WebSocket server
    websocketServer.initialize(server);

    // Get local IP address for network access
    const os = require("os");
    const networkInterfaces = os.networkInterfaces();
    let localIP = null;

    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      for (const iface of interfaces) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (iface.family === "IPv4" && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
      if (localIP) break;
    }

    // Start HTTP server (Express + WebSocket)
    const HOST = process.env.HOST || "0.0.0.0";
    server.listen(PORT, HOST, () => {
      console.log("\n" + "=".repeat(60));
      console.log("🚀 OptiConnect GIS Backend Server Started Successfully!");
      console.log("=".repeat(60));
      console.log(`📡 HTTP Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket Server: ws://localhost:${PORT}/ws`);
      console.log(`🌍 Environment: ${env}`);
      console.log(
        `📊 Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST}`
      );
      console.log(`🔒 CORS Enabled: ${process.env.FRONTEND_URL}`);
      console.log("=".repeat(60));
      console.log("  Access URLs:");
      console.log("=".repeat(60));
      console.log(`  Local (this computer):   http://localhost:${PORT}`);
      if (localIP) {
        console.log(`  Network (other devices): http://${localIP}:${PORT}`);
        console.log("");
        console.log("  📱 TO ACCESS FROM ANOTHER LAPTOP:");
        console.log(`     1. Connect laptop to same Wi-Fi/network`);
        console.log(
          `     2. Open browser and go to: http://${localIP}:${PORT}`
        );
        console.log(
          `     3. Frontend should use: http://${localIP}:${PORT}/api`
        );
        console.log(`     4. WebSocket should use: ws://${localIP}:${PORT}/ws`);
      }
      console.log("=".repeat(60));
      console.log("📚 API Documentation: http://localhost:" + PORT + "/");
      console.log("💚 Health Check: http://localhost:" + PORT + "/api/health");
      console.log("=".repeat(60) + "\n");
      console.log("🔥 Server is ready to accept requests!\n");
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

module.exports = { app, server, websocketServer };
