const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const { cacheMiddleware, clearCacheOnMutation } = require("../middleware/cache");
const {
  getAllInfrastructure,
  getInfrastructureById,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  importKML,
  getImportPreview,
  saveImportedItems,
  saveSingleImportedItem,
  deleteImportSession,
  getInfrastructureStats,
  getCategories,
  getMapViewInfrastructure,
  getClusters
} = require("../controllers/infrastructureController");
const {
  getInfrastructureAuditLogs,
  getInfrastructureAuditLogById,
  deleteInfrastructureAuditLog,
  clearInfrastructureAuditLogs,
  getInfrastructureAuditStats,
  getInfrastructureItemAuditHistory,
  exportAuditLogs,
  getAuditActions
} = require("../controllers/infrastructureAuditController");

// All routes require authentication
router.use(authenticate);

// Statistics (before :id route to avoid conflicts) - with caching
router.get("/stats", cacheMiddleware(300), getInfrastructureStats);

// Categories endpoint (before :id route to avoid conflicts) - with caching
router.get("/categories", cacheMiddleware(600), getCategories);

// Map view endpoints (before :id route to avoid conflicts) - with caching
router.get("/map-view", cacheMiddleware(120), getMapViewInfrastructure); // 2 min cache for map
router.get("/clusters", cacheMiddleware(120), getClusters); // 2 min cache for clusters

// Audit endpoints (before :id route to avoid conflicts)
router.get("/audit", authorize("admin", "Admin"), getInfrastructureAuditLogs);
router.get(
  "/audit/stats",
  authorize("admin", "Admin"),
  getInfrastructureAuditStats
);
router.get("/audit/export", authorize("admin", "Admin"), exportAuditLogs);
router.get("/audit/actions", authorize("admin", "Admin"), getAuditActions);
router.get(
  "/audit/:id",
  authorize("admin", "Admin"),
  getInfrastructureAuditLogById
);
router.delete(
  "/audit/:id",
  authorize("admin", "Admin"),
  deleteInfrastructureAuditLog
);
router.delete(
  "/audit",
  authorize("admin", "Admin"),
  clearInfrastructureAuditLogs
);

// 🆕 KML Import endpoints - NOW AVAILABLE TO ALL USERS (Admin/Manager/Technician/User)
// Users can import KML temporarily, then choose to "Save" it permanently
router.post("/import/kml", importKML); // ✅ All authenticated users can import
router.get("/import/:sessionId/preview", getImportPreview); // ✅ View preview
router.post("/import/:sessionId/save-item/:itemId", clearCacheOnMutation(["/api/infrastructure"]), saveSingleImportedItem); // ✅ Save individual item
router.post("/import/:sessionId/save", clearCacheOnMutation(["/api/infrastructure"]), saveImportedItems); // ✅ Save all selected items (bulk)
router.delete("/import/:sessionId", deleteImportSession); // ✅ Delete temporary import

// CRUD operations - with caching and cache invalidation
router.get("/", cacheMiddleware(60), getAllInfrastructure); // 1 min cache
router.get("/:id", cacheMiddleware(300), getInfrastructureById); // 5 min cache
router.get("/:id/audit", getInfrastructureItemAuditHistory); // Get audit history for specific item
router.post("/", clearCacheOnMutation(["/api/infrastructure"]), createInfrastructure);
router.put("/:id", clearCacheOnMutation(["/api/infrastructure"]), updateInfrastructure);
router.delete("/:id", clearCacheOnMutation(["/api/infrastructure"]), deleteInfrastructure);

module.exports = router;
