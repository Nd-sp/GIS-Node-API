const { pool } = require("../config/database");

/**
 * @route   GET /api/infrastructure/stats
 * @desc    Get infrastructure statistics
 * @access  Private
 *
 * Returns aggregated statistics:
 * - Total infrastructure count
 * - Counts by type (POP, SubPOP, etc.)
 * - Counts by source (KML, Manual)
 * - Counts by status (Active, Inactive, etc.)
 * - Rental statistics
 *
 * Role-based filtering:
 * - Admin/Manager: See stats for all infrastructure
 * - Regular users: See stats only for their accessible regions
 */
const getInfrastructureStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = "1=1";
    const params = [];

    // Role-based filtering
    if (userRole !== "admin" && userRole !== "manager") {
      whereClause = `(
        user_id = ?
        OR region_id IN (
          SELECT region_id FROM user_regions WHERE user_id = ?
          UNION
          SELECT region_id FROM temporary_access_log
          WHERE user_id = ?
          AND end_time > NOW() AND status != 'revoked'
        )
        OR (
          region_id IS NULL
          AND EXISTS (
            SELECT 1 FROM user_regions WHERE user_id = ?
            UNION
            SELECT 1 FROM temporary_access_log
            WHERE user_id = ?
            AND end_time > NOW() AND status != 'revoked'
          )
        )
      )`;
      params.push(userId, userId, userId, userId, userId);
    }

    const [stats] = await pool.query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN item_type = 'POP' THEN 1 ELSE 0 END) as pop_count,
        SUM(CASE WHEN item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop_count,
        SUM(CASE WHEN source = 'KML' THEN 1 ELSE 0 END) as kml_count,
        SUM(CASE WHEN source = 'Manual' THEN 1 ELSE 0 END) as manual_count,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'Inactive' THEN 1 ELSE 0 END) as inactive_count,
        SUM(CASE WHEN is_rented = TRUE THEN 1 ELSE 0 END) as rented_count
       FROM infrastructure_items
       WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error("Get infrastructure stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get infrastructure statistics"
    });
  }
};

/**
 * @route   GET /api/infrastructure/categories
 * @desc    Get infrastructure categories
 * @access  Private
 *
 * Returns list of available infrastructure categories/types.
 * Optionally filter by type.
 */
const getCategories = async (req, res) => {
  try {
    const { type } = req.query;

    let query =
      "SELECT * FROM infrastructure_categories WHERE is_active = TRUE";
    const params = [];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY type, name";

    const [categories] = await pool.query(query, params);

    res.json({
      success: true,
      data: categories,
      count: categories.length
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ success: false, error: "Failed to get categories" });
  }
};

/**
 * @route   GET /api/infrastructure/validate/coordinates
 * @desc    Scan and report invalid coordinates (Admin only)
 * @access  Private (Admin)
 *
 * Utility endpoint to validate all infrastructure coordinates.
 * Helps identify items outside India boundaries.
 *
 * Query Params:
 * - format: 'json' | 'csv' | 'sql' | 'full'
 *   - json: Returns summary (default)
 *   - csv: Downloads CSV file with invalid items
 *   - sql: Downloads SQL script to delete invalid items
 *   - full: Comprehensive report with analysis by source
 */
const validateCoordinates = async (req, res) => {
  try {
    const userRole = (req.user.role || "").toLowerCase();

    // Only admin can run this scan
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin only."
      });
    }

    const {
      scanInvalidCoordinates,
      generateDeleteScript,
      generateCSVReport,
      analyzeBySource,
      generateFixReport
    } = require("../utils/coordinateFixUtility");

    const format = req.query.format || "json"; // json, csv, sql

    if (format === "full") {
      // Generate comprehensive report
      const report = await generateFixReport();
      return res.json({
        success: true,
        report
      });
    }

    // Basic scan
    const scanResult = await scanInvalidCoordinates();

    if (format === "csv") {
      const csv = generateCSVReport(scanResult.details.invalidCoordinates);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=invalid_coordinates.csv");
      return res.send(csv);
    }

    if (format === "sql") {
      const sql = generateDeleteScript(scanResult.details.invalidCoordinates);
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Content-Disposition", "attachment; filename=delete_invalid_coordinates.sql");
      return res.send(sql);
    }

    // Default JSON response
    res.json({
      success: true,
      ...scanResult
    });
  } catch (error) {
    console.error("Coordinate validation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate coordinates"
    });
  }
};

/**
 * @route   GET /api/infrastructure/debug/counts
 * @desc    Debug endpoint to check raw database counts (Admin only)
 * @access  Private (Admin)
 *
 * Returns detailed breakdown of infrastructure counts:
 * - Total infrastructure in database
 * - User's own infrastructure
 * - User's assigned regions
 * - Infrastructure in assigned regions
 * - Infrastructure by type
 *
 * Useful for troubleshooting filtering issues.
 */
const debugGetCounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || "").toLowerCase();

    // Get total count
    const [totalResult] = await pool.query(
      "SELECT COUNT(*) as total FROM infrastructure_items"
    );

    // Get count by user
    const [userResult] = await pool.query(
      "SELECT COUNT(*) as user_total FROM infrastructure_items WHERE created_by = ?",
      [userId]
    );

    // Get user's assigned regions
    const [userRegions] = await pool.query(
      "SELECT r.id, r.name FROM user_regions ur JOIN regions r ON ur.region_id = r.id WHERE ur.user_id = ?",
      [userId]
    );

    // Get count by assigned regions
    const [regionResult] = await pool.query(
      `SELECT COUNT(*) as region_total FROM infrastructure_items
       WHERE region_id IN (SELECT region_id FROM user_regions WHERE user_id = ?)`,
      [userId]
    );

    // Get infrastructure by type
    const [typeResult] = await pool.query(
      `SELECT item_type, COUNT(*) as count FROM infrastructure_items GROUP BY item_type`
    );

    res.json({
      success: true,
      debug: {
        userId,
        userRole,
        totalInfrastructure: totalResult[0].total,
        userInfrastructure: userResult[0].user_total,
        userAssignedRegions: userRegions,
        infrastructureInAssignedRegions: regionResult[0].region_total,
        infrastructureByType: typeResult
      }
    });
  } catch (error) {
    console.error("Debug counts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get debug counts"
    });
  }
};

module.exports = {
  getInfrastructureStats,
  getCategories,
  validateCoordinates,
  debugGetCounts
};
