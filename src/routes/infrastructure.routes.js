const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");
const {
  getAllInfrastructure,
  getInfrastructureById,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  importKML,
  getImportPreview,
  saveImportedItems,
  deleteImportSession,
  getInfrastructureStats,
  getCategories
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

// Statistics (before :id route to avoid conflicts)
router.get("/stats", getInfrastructureStats);

// Categories endpoint (before :id route to avoid conflicts)
router.get("/categories", getCategories);

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

// KML Import endpoints (before :id route)
router.post("/import/kml", authorize("admin", "manager"), importKML);
router.get(
  "/import/:sessionId/preview",
  authorize("admin", "manager"),
  getImportPreview
);
router.post(
  "/import/:sessionId/save",
  authorize("admin", "manager"),
  saveImportedItems
);
router.delete(
  "/import/:sessionId",
  authorize("admin", "manager"),
  deleteImportSession
);

// CRUD operations
router.get("/", getAllInfrastructure);
router.get("/:id", getInfrastructureById);
router.get("/:id/audit", getInfrastructureItemAuditHistory); // Get audit history for specific item
router.post("/", createInfrastructure);
router.put("/:id", updateInfrastructure);
router.delete("/:id", deleteInfrastructure);

module.exports = router;
