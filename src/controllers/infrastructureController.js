const { pool } = require("../config/database");
const {
  isValidIndiaCoordinate,
  getNearestState
} = require("../utils/coordinateValidator");
const {
  logAudit,
  detectRegionFromCoordinates,
  canAccessInfrastructure,
  buildRoleFilterClause
} = require("./infrastructureHelpers");

/**
 * @route   GET /api/infrastructure
 * @desc    Get all infrastructure items (with role-based filtering, no pagination)
 * @access  Private
 *
 * Query Parameters:
 * - regionId: Filter by region
 * - item_type: Filter by type (POP, SubPOP, etc.)
 * - status: Filter by status (Active, Inactive, etc.)
 * - source: Filter by source (KML, Manual, etc.)
 * - search: Text search in name, unique_id, network_id, city, state
 * - filter: 'all' | 'user' - Admin/Manager can view all or specific user data
 * - userId: Specific user ID to filter by (Admin/Manager only)
 * - sortBy: Column to sort by (default: created_at)
 * - sortOrder: ASC | DESC (default: DESC)
 *
 * Role-based filtering:
 * - Admin/Manager with filter='all': See ALL data
 * - Admin/Manager with filter='user': See specific user's data
 * - Regular users: See ONLY data from their assigned regions
 */
const getAllInfrastructure = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || "").toLowerCase();
    const {
      regionId,
      item_type,
      status,
      source,
      search,
      filter,
      userId: filterUserId,
      sortBy,
      sortOrder
    } = req.query;

    console.log("🏗️ Infrastructure getAllInfrastructure request:", {
      userId,
      userRole,
      filter,
      filterUserId
    });

    const sortColumn = sortBy || "created_at";
    const sortDirection = sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    let query = `
      SELECT i.*,
        u.username as owner_username,
        u.full_name as owner_name,
        r.name as region_name
      FROM infrastructure_items i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE 1=1
    `;

    const params = [];
    const roleFilterClause = [];

    // Role-based filtering
    if (filter === "all" && (userRole === "admin" || userRole === "manager")) {
      // Admin/Manager viewing all data - no additional filter
      console.log("🏗️ Admin/Manager viewing ALL data");
    } else if (
      filter === "user" &&
      (userRole === "admin" || userRole === "manager") &&
      filterUserId
    ) {
      // Admin/Manager viewing specific user's data
      const parsedUserId = parseInt(filterUserId);
      if (!isNaN(parsedUserId) && parsedUserId > 0) {
        const userFilterClause = " AND i.created_by = ?";
        roleFilterClause.push(userFilterClause);
        params.push(parsedUserId);
        console.log("🏗️ Admin/Manager viewing user", parsedUserId);
      } else {
        const userFilterClause = " AND i.created_by = ?";
        roleFilterClause.push(userFilterClause);
        params.push(userId);
        console.log("🏗️ Invalid userId filter, using current user");
      }
    } else {
      // Regular users or admin without filter
      if (userRole !== "admin" && userRole !== "manager") {
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
        roleFilterClause.push(userFilterClause);
        params.push(userId, userId);
        console.log("🏗️ Regular user viewing data from assigned regions");
      } else {
        console.log("🏗️ Admin/Manager - NO region filtering");
      }
    }

    // Apply role filter
    query += roleFilterClause.join("");

    // Additional filters
    if (regionId) {
      query += " AND i.region_id = ?";
      params.push(regionId);
    }
    if (item_type) {
      query += " AND i.item_type = ?";
      params.push(item_type);
    }
    if (status) {
      query += " AND i.status = ?";
      params.push(status);
    }
    if (source) {
      query += " AND i.source = ?";
      params.push(source);
    }
    if (search) {
      const searchClause = ` AND (
        i.item_name LIKE ? OR
        i.unique_id LIKE ? OR
        i.network_id LIKE ? OR
        i.address_city LIKE ? OR
        i.address_state LIKE ?
      )`;
      query += searchClause;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    const allowedSortColumns = [
      "created_at",
      "updated_at",
      "item_name",
      "item_type",
      "status",
      "latitude",
      "longitude"
    ];
    const safeSortColumn = allowedSortColumns.includes(sortColumn)
      ? sortColumn
      : "created_at";
    query += ` ORDER BY i.${safeSortColumn} ${sortDirection}`;

    // Execute query
    const [items] = await pool.query(query, params);

    console.log("🏗️ Infrastructure getAllInfrastructure response:", {
      count: items.length
    });

    res.json({
      success: true,
      items: items,
      count: items.length
    });
  } catch (error) {
    console.error("Get infrastructure error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to get infrastructure items" });
  }
};

/**
 * @route   GET /api/infrastructure/:id
 * @desc    Get infrastructure item by ID
 * @access  Private
 */
const getInfrastructureById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [items] = await pool.query(
      `SELECT i.*,
        u.username as owner_username,
        u.full_name as owner_name,
        r.name as region_name
      FROM infrastructure_items i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE i.id = ?`,
      [id]
    );

    if (items.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Infrastructure item not found" });
    }

    const item = items[0];

    // Check access
    const hasAccess = await canAccessInfrastructure(
      userId,
      userRole,
      item.created_by,
      item.region_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    res.json({ success: true, data: item });
  } catch (error) {
    console.error("Get infrastructure item error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to get infrastructure item" });
  }
};

/**
 * @route   POST /api/infrastructure
 * @desc    Create infrastructure item
 * @access  Private
 *
 * Required fields:
 * - item_type, item_name, unique_id, latitude, longitude
 *
 * Features:
 * - Validates coordinates are within India
 * - Auto-detects region from coordinates
 * - Logs audit trail
 */
const createInfrastructure = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      item_type,
      item_name,
      unique_id,
      network_id,
      ref_code,
      latitude,
      longitude,
      height,
      address_street,
      address_city,
      address_state,
      address_pincode,
      contact_name,
      contact_phone,
      contact_email,
      customer_name,
      icon_type,
      is_rented,
      rent_amount,
      agreement_start_date,
      agreement_end_date,
      landlord_name,
      landlord_contact,
      nature_of_business,
      owner,
      structure_type,
      ups_availability,
      ups_capacity,
      backup_capacity,
      power_source,
      equipment_list,
      connected_to,
      bandwidth,
      status,
      installation_date,
      maintenance_due_date,
      source,
      notes,
      properties,
      capacity,
      equipment_details
    } = req.body;

    if (!item_type || !item_name || !unique_id || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error:
          "Required fields: item_type, item_name, unique_id, latitude, longitude"
      });
    }

    // Validate coordinates are within India
    const validation = isValidIndiaCoordinate(latitude, longitude);
    if (!validation.valid) {
      const nearest = getNearestState(latitude, longitude);
      return res.status(400).json({
        success: false,
        error: `Invalid coordinates: ${validation.error}`,
        suggestion: nearest.suggestion,
        nearestState: nearest.state,
        distanceKm: nearest.distance
      });
    }

    // Auto-detect region from coordinates
    const region_id = await detectRegionFromCoordinates(latitude, longitude);

    const [result] = await pool.query(
      `INSERT INTO infrastructure_items
       (region_id, created_by, item_type, item_name, unique_id, network_id, ref_code,
        latitude, longitude, height,
        address_street, address_city, address_state, address_pincode,
        contact_name, contact_phone, contact_email, customer_name, icon_type,
        is_rented, rent_amount, agreement_start_date, agreement_end_date,
        landlord_name, landlord_contact, nature_of_business, owner,
        structure_type, ups_availability, ups_capacity, backup_capacity, power_source,
        equipment_list, connected_to, bandwidth,
        status, installation_date, maintenance_due_date,
        source, notes, properties, capacity, equipment_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        region_id,
        userId,
        item_type,
        item_name,
        unique_id,
        network_id,
        ref_code,
        latitude,
        longitude,
        height,
        address_street,
        address_city,
        address_state,
        address_pincode,
        contact_name,
        contact_phone,
        contact_email,
        customer_name || null,
        icon_type || null,
        is_rented || false,
        rent_amount,
        agreement_start_date,
        agreement_end_date,
        landlord_name,
        landlord_contact,
        nature_of_business,
        owner,
        structure_type || "Tower",
        ups_availability || false,
        ups_capacity,
        backup_capacity,
        power_source || "Grid",
        equipment_list ? JSON.stringify(equipment_list) : null,
        connected_to ? JSON.stringify(connected_to) : null,
        bandwidth,
        status || "Active",
        installation_date,
        maintenance_due_date,
        source || "Manual",
        notes,
        properties ? JSON.stringify(properties) : null,
        capacity ? JSON.stringify(capacity) : null,
        equipment_details ? JSON.stringify(equipment_details) : null
      ]
    );

    // Log audit
    await logAudit(
      result.insertId,
      userId,
      "CREATE",
      null,
      {
        item_type,
        item_name,
        unique_id,
        latitude,
        longitude,
        status: status || "Active"
      },
      req
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        item_type,
        item_name,
        unique_id,
        status: status || "Active",
        region_id
      }
    });
  } catch (error) {
    console.error("Create infrastructure error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create infrastructure item" });
  }
};

/**
 * @route   PUT /api/infrastructure/:id
 * @desc    Update infrastructure item
 * @access  Private
 */
const updateInfrastructure = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const updateFields = req.body;

    // Check if item exists and user has access
    const [items] = await pool.query(
      "SELECT * FROM infrastructure_items WHERE id = ?",
      [id]
    );
    if (items.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Infrastructure item not found" });
    }

    const item = items[0];
    const hasAccess = await canAccessInfrastructure(
      userId,
      userRole,
      item.created_by,
      item.region_id
    );
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const allowedFields = [
      "item_name",
      "network_id",
      "ref_code",
      "height",
      "address_street",
      "address_city",
      "address_state",
      "address_pincode",
      "contact_name",
      "contact_phone",
      "contact_email",
      "is_rented",
      "rent_amount",
      "agreement_start_date",
      "agreement_end_date",
      "landlord_name",
      "landlord_contact",
      "nature_of_business",
      "owner",
      "structure_type",
      "ups_availability",
      "ups_capacity",
      "backup_capacity",
      "power_source",
      "equipment_list",
      "connected_to",
      "bandwidth",
      "status",
      "installation_date",
      "maintenance_due_date",
      "notes",
      "properties"
    ];

    const updates = [];
    const params = [];

    Object.keys(updateFields).forEach((field) => {
      if (allowedFields.includes(field)) {
        updates.push(`${field} = ?`);
        const value =
          ["equipment_list", "connected_to", "properties"].includes(field) &&
          typeof updateFields[field] === "object"
            ? JSON.stringify(updateFields[field])
            : updateFields[field];
        params.push(value);
      }
    });

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No valid fields to update" });
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    await pool.query(
      `UPDATE infrastructure_items SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // Log audit
    await logAudit(id, userId, "UPDATE", item, updateFields, req);

    res.json({
      success: true,
      message: "Infrastructure item updated successfully"
    });
  } catch (error) {
    console.error("Update infrastructure error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update infrastructure item" });
  }
};

/**
 * @route   DELETE /api/infrastructure/:id
 * @desc    Delete infrastructure item
 * @access  Private
 */
const deleteInfrastructure = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if item exists and user has access
    const [items] = await pool.query(
      "SELECT * FROM infrastructure_items WHERE id = ?",
      [id]
    );
    if (items.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Infrastructure item not found" });
    }

    const item = items[0];

    // Admin/Manager can delete user-added data
    // Regular users can only delete their own data
    if (
      userRole !== "admin" &&
      userRole !== "manager" &&
      item.user_id !== userId
    ) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    // Log audit before deleting
    await logAudit(id, userId, "DELETE", item, null, req);

    await pool.query("DELETE FROM infrastructure_items WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Infrastructure item deleted successfully"
    });
  } catch (error) {
    console.error("Delete infrastructure error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete infrastructure item" });
  }
};

module.exports = {
  getAllInfrastructure,
  getInfrastructureById,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure
};
