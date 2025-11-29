const { pool } = require("../config/database");
const {
  isValidIndiaCoordinate,
  detectState,
  getNearestState
} = require("../utils/coordinateValidator");

/**
 * Helper: Log audit trail for infrastructure operations
 *
 * @param {number} infrastructureId - Infrastructure item ID
 * @param {number} userId - User performing the action
 * @param {string} action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {object} oldValues - Previous values (for UPDATE/DELETE)
 * @param {object} newValues - New values (for CREATE/UPDATE)
 * @param {object} req - Express request object (for IP and user agent)
 */
const logAudit = async (
  infrastructureId,
  userId,
  action,
  oldValues,
  newValues,
  req
) => {
  try {
    const ipAddress =
      req?.ip ||
      req?.headers?.["x-forwarded-for"] ||
      req?.connection?.remoteAddress ||
      null;
    const userAgent = req?.headers?.["user-agent"] || null;

    await pool.query(
      `INSERT INTO infrastructure_audit
       (infrastructure_id, user_id, action, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        infrastructureId,
        userId,
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error("Audit logging error:", error);
    // Don't fail the main operation if audit fails
  }
};

/**
 * Helper: Auto-detect region from coordinates
 * Uses coordinate validator with comprehensive state boundaries
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {number|null} Region ID or null if not found
 */
const detectRegionFromCoordinates = async (lat, lng) => {
  try {
    // Validate coordinates are within India
    const validation = isValidIndiaCoordinate(lat, lng);
    if (!validation.valid) {
      console.warn(`⚠️ Invalid coordinates (${lat}, ${lng}): ${validation.error}`);
      const nearest = getNearestState(lat, lng);
      console.warn(`   Nearest state: ${nearest.state} (${nearest.distance}km away)`);
      return null;
    }

    // Detect state using coordinate validator
    const stateDetection = detectState(lat, lng);
    if (!stateDetection.found) {
      console.warn(`⚠️ State not detected for (${lat}, ${lng}): ${stateDetection.message}`);
      return null;
    }

    // Find region ID from database
    const [regions] = await pool.query(
      "SELECT id FROM regions WHERE name = ? AND is_active = TRUE LIMIT 1",
      [stateDetection.state]
    );

    if (regions.length > 0) {
      console.log(`✅ Detected region: ${stateDetection.state} (ID: ${regions[0].id})`);
      return regions[0].id;
    } else {
      console.warn(`⚠️ Region "${stateDetection.state}" not found in database`);
      return null;
    }
  } catch (error) {
    console.error("Error detecting region:", error);
    return null;
  }
};

/**
 * Helper: Check user access to infrastructure
 *
 * Permissions:
 * - Admin and Manager: Can access all infrastructure
 * - Users: Can access their own infrastructure or infrastructure in their assigned regions
 *
 * @param {number} userId - User ID
 * @param {string} userRole - User role (admin, manager, user, etc.)
 * @param {number} infraUserId - Infrastructure owner user ID
 * @param {number} regionId - Infrastructure region ID
 * @returns {boolean} True if user has access, false otherwise
 */
const canAccessInfrastructure = async (
  userId,
  userRole,
  infraUserId,
  regionId
) => {
  // Admin and manager can access all infrastructure
  if (userRole === "admin" || userRole === "manager") {
    return true;
  }

  // User can access their own infrastructure
  if (userId === infraUserId) {
    return true;
  }

  // Check if user has access to the region
  if (regionId) {
    const [regionAccess] = await pool.query(
      `SELECT ur.id FROM user_regions ur
       WHERE ur.user_id = ? AND ur.region_id = ?
       UNION
       SELECT ta.id FROM temporary_access_log ta
       WHERE ta.user_id = ?  AND ta.region_id = ?
       AND ta.end_time > NOW() AND ta.status != 'revoked'`,
      [userId, regionId, userId, regionId]
    );

    if (regionAccess.length > 0) {
      return true;
    }
  }

  return false;
};

/**
 * Helper: Build role-based filter SQL clause and params
 * This consolidates the filtering logic used across multiple controllers
 *
 * @param {number} userId - Current user ID
 * @param {string} userRole - Current user role
 * @param {string} filter - Filter type ('all', 'user', or undefined)
 * @param {number} filterUserId - Filter for specific user ID
 * @returns {object} { clause: string, params: array }
 */
const buildRoleFilterClause = (userId, userRole, filter, filterUserId) => {
  const clause = [];
  const params = [];

  if (filter === "all" && (userRole === "admin" || userRole === "manager")) {
    // Admin/Manager viewing ALL users' data - no filter
    console.log("🏗️ Admin/Manager viewing ALL infrastructure data");
  } else if (
    filter === "user" &&
    (userRole === "admin" || userRole === "manager") &&
    filterUserId
  ) {
    // Admin/Manager viewing specific user's data
    const parsedUserId = parseInt(filterUserId);
    if (!isNaN(parsedUserId) && parsedUserId > 0) {
      clause.push(" AND i.created_by = ?");
      params.push(parsedUserId);
      console.log("🏗️ Admin/Manager viewing user", parsedUserId);
    } else {
      console.log("⚠️ Invalid userId filter, defaulting to current user");
      clause.push(" AND i.created_by = ?");
      params.push(userId);
    }
  } else {
    // Default: Users see only their own data or data from assigned regions
    if (userRole === "admin" || userRole === "manager") {
      // Admin/Manager without filter sees all data
      console.log("🏗️ Admin/Manager viewing all data (no filter specified)");
    } else {
      // Regular users see ONLY data from their assigned regions
      const userFilterClause = ` AND (
        i.region_id IN (
          SELECT region_id FROM user_regions WHERE user_id = ?
          UNION
          SELECT region_id FROM temporary_access_log
          WHERE user_id = ?
          AND end_time > NOW() AND status != 'revoked'
        )
      )`;
      clause.push(userFilterClause);
      params.push(userId, userId);
      console.log("🏗️ Regular user viewing data from assigned regions");
    }
  }

  return { clause: clause.join(""), params };
};

module.exports = {
  logAudit,
  detectRegionFromCoordinates,
  canAccessInfrastructure,
  buildRoleFilterClause
};
