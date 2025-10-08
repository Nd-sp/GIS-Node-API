const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { testConnection } = require("./src/config/database");
const { errorHandler, notFound } = require("./src/middleware/errorHandler");

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logger (only in development)
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false
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
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    database: "connected",
    timestamp: new Date().toISOString()
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

  console.log("✅ All routes loaded successfully");
} catch (error) {
  console.warn("⚠️ Some routes not loaded yet:", error.message);
}

// 404 handler
app.use(notFound);

// Error handler middleware (must be last)
app.use(errorHandler);

// Server configuration
const PORT = process.env.PORT || 5000;

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
