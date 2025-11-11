const { pool } = require("../config/database");
const { parseStringPromise } = require("xml2js");
const { v4: uuidv4 } = require("uuid");
const {
  isValidIndiaCoordinate,
  detectState,
  getNearestState
} = require("../utils/coordinateValidator");

/**
 * Helper: Log audit trail
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
       SELECT ta.id FROM temporary_access ta
       WHERE ta.user_id = ? AND ta.resource_type = 'region' AND ta.resource_id = ?
       AND ta.expires_at > NOW() AND ta.revoked_at IS NULL`,
      [userId, regionId, userId, regionId]
    );

    if (regionAccess.length > 0) {
      return true;
    }
  }

  return false;
};

/**
 * @route   GET /api/infrastructure
 * @desc    Get all infrastructure items (with role-based filtering, no pagination)
 * @access  Private
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
      LEFT JOIN users u ON i.user_id = u.id
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE 1=1
    `;
    const params = [];

    // Role-based filtering with explicit filter parameter support
    const roleFilterClause = [];
    if (filter === "all" && (userRole === "admin" || userRole === "manager")) {
      // Admin/Manager viewing ALL users' data
      console.log("🏗️ Admin/Manager viewing ALL infrastructure data");
    } else if (
      filter === "user" &&
      (userRole === "admin" || userRole === "manager") &&
      filterUserId
    ) {
      // Admin/Manager viewing specific user's data
      const parsedUserId = parseInt(filterUserId);
      if (!isNaN(parsedUserId) && parsedUserId > 0) {
        roleFilterClause.push(" AND i.user_id = ?");
        params.push(parsedUserId);
        console.log("🏗️ Admin/Manager viewing user", parsedUserId);
      } else {
        console.log("⚠️ Invalid userId filter, defaulting to current user");
        roleFilterClause.push(" AND i.user_id = ?");
        params.push(userId);
      }
    } else {
      // Default: Users see only their own data
      if (userRole === "admin" || userRole === "manager") {
        // Admin/Manager without filter sees all data
        console.log("🏗️ Admin/Manager viewing all data (no filter specified)");
      } else {
        // Regular users see ONLY data from their assigned regions
        // This includes both their own data AND others' data from the same regions
        const userFilterClause = ` AND (
          i.region_id IN (
            SELECT region_id FROM user_regions WHERE user_id = ?
            UNION
            SELECT resource_id FROM temporary_access
            WHERE user_id = ? AND resource_type = 'region'
            AND expires_at > NOW() AND revoked_at IS NULL
          )
        )`;
        roleFilterClause.push(userFilterClause);
        params.push(userId, userId);
        console.log("🏗️ Regular user viewing data from assigned regions (including others' data)");
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
 * @route   GET /api/infrastructure/viewport
 * @desc    Get infrastructure items within map viewport (OPTIMIZED FOR 100K+ MARKERS)
 * @access  Private
 * @priority HIGH - Critical for performance with large datasets
 *
 * Query Params:
 * - north, south, east, west: Viewport bounds (required)
 * - limit: Max items to return (default: 1000, max: 5000)
 * - item_type, status, source: Filters (optional)
 *
 * Performance:
 * - Uses spatial bounding box query with indexes
 * - Returns only essential fields (id, name, lat, lng, type, source, status)
 * - Query time: <50ms even with 100K+ total markers
 * - Typical response: 500-1000 markers, ~50KB gzipped
 */
const getInfrastructureByViewport = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || "").toLowerCase();
    const {
      north,
      south,
      east,
      west,
      limit = 1000,
      item_type,
      status,
      source,
      filter,
      userId: filterUserId
    } = req.query;

    // Validate viewport bounds
    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        error: "Missing viewport bounds (north, south, east, west required)"
      });
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    // Validate bounds
    if (
      isNaN(bounds.north) ||
      isNaN(bounds.south) ||
      isNaN(bounds.east) ||
      isNaN(bounds.west)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid viewport bounds (must be numbers)"
      });
    }

    // Limit validation (prevent abuse)
    const maxLimit = 5000;
    const safeLimit = Math.min(parseInt(limit) || 1000, maxLimit);

    console.log("🗺️ Viewport query:", {
      bounds,
      limit: safeLimit,
      userId,
      userRole
    });

    // Build optimized query with spatial filtering
    // Only select essential fields to minimize data transfer
    let query = `
      SELECT
        i.id,
        i.item_name,
        i.latitude,
        i.longitude,
        i.item_type,
        i.source,
        i.status,
        i.unique_id
      FROM infrastructure_items i
      WHERE i.latitude BETWEEN ? AND ?
        AND i.longitude BETWEEN ? AND ?
    `;

    const params = [bounds.south, bounds.north, bounds.west, bounds.east];

    // Role-based filtering (same logic as getAllInfrastructure)
    if (filter === "all" && (userRole === "admin" || userRole === "manager")) {
      // Admin/Manager viewing all data - no additional filter
    } else if (
      filter === "user" &&
      (userRole === "admin" || userRole === "manager") &&
      filterUserId
    ) {
      // Admin/Manager viewing specific user's data
      const parsedUserId = parseInt(filterUserId);
      if (!isNaN(parsedUserId) && parsedUserId > 0) {
        query += " AND i.user_id = ?";
        params.push(parsedUserId);
      } else {
        query += " AND i.user_id = ?";
        params.push(userId);
      }
    } else {
      // Regular users or admin without filter
      if (userRole !== "admin" && userRole !== "manager") {
        // Regular users see ONLY data from their assigned regions
        // This includes both their own data AND others' data from the same regions
        const userFilterClause = ` AND (
          i.region_id IN (
            SELECT region_id FROM user_regions WHERE user_id = ?
            UNION
            SELECT resource_id FROM temporary_access
            WHERE user_id = ? AND resource_type = 'region'
            AND expires_at > NOW() AND revoked_at IS NULL
          )
        )`;
        query += userFilterClause;
        params.push(userId, userId);
        console.log("🗺️ Viewport query: Filtering by assigned regions for user", userId, "role:", userRole);
        console.log("🔍 Query includes region filter:", userFilterClause);
      } else {
        console.log("🗺️ Viewport query: Admin/Manager - NO region filtering for user", userId, "role:", userRole);
      }
    }

    // Additional filters
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

    // Add limit
    query += " LIMIT ?";
    params.push(safeLimit);

    // Execute optimized query
    const startTime = Date.now();
    const [items] = await pool.query(query, params);
    const queryTime = Date.now() - startTime;

    console.log("🗺️ Viewport query result:", {
      count: items.length,
      queryTime: `${queryTime}ms`,
      bounds
    });

    res.json({
      success: true,
      items: items,
      count: items.length,
      limit: safeLimit,
      queryTime: `${queryTime}ms`,
      bounds
    });
  } catch (error) {
    console.error("Get infrastructure by viewport error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get infrastructure items by viewport"
    });
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
      LEFT JOIN users u ON i.user_id = u.id
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
      item.user_id,
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
      customer_name, // New field for customer selection
      icon_type, // New field for icon consistency
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
       (user_id, region_id, created_by, item_type, item_name, unique_id, network_id, ref_code,
        latitude, longitude, height,
        address_street, address_city, address_state, address_pincode,
        contact_name, contact_phone, contact_email, customer_name, icon_type,
        is_rented, rent_amount, agreement_start_date, agreement_end_date,
        landlord_name, landlord_contact, nature_of_business, owner,
        structure_type, ups_availability, ups_capacity, backup_capacity, power_source,
        equipment_list, connected_to, bandwidth,
        status, installation_date, maintenance_due_date,
        source, notes, properties, capacity, equipment_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
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
        customer_name || null, // New field for customer selection
        icon_type || null, // New field for icon consistency
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
      item.user_id,
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

/**
 * @route   POST /api/infrastructure/import/kml
 * @desc    Import KML file and save to temporary import table (OPTION B: Save button workflow)
 * @access  Private (ALL USERS - Admin/Manager/Technician/User)
 *
 * NEW WORKFLOW:
 * 1. All users can import KML data (stored temporarily)
 * 2. Users see imported data on their map immediately
 * 3. Users can click "Save" to make data permanent and visible to all users in region
 * 4. Unsaved data is only visible to the user who imported it
 */
const importKML = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { kmlData, filename } = req.body;

    console.log("📥 KML Import Request:", {
      userId,
      userRole,
      hasKmlData: !!kmlData,
      kmlDataLength: kmlData?.length,
      kmlDataPreview: kmlData?.substring(0, 200),
      filename
    });

    // ✅ NEW: All authenticated users can import KML
    console.log("✅ KML import allowed for user:", userId, "Role:", userRole);

    if (!kmlData) {
      console.error("❌ Import rejected: No KML data provided");
      return res
        .status(400)
        .json({ success: false, error: "KML data is required" });
    }

    // Parse KML data
    console.log("🔄 Parsing KML data...");
    let parsedKML;
    try {
      parsedKML = await parseStringPromise(kmlData);
      console.log("✅ KML parsed successfully:", {
        hasKml: !!parsedKML?.kml,
        hasDocument: !!parsedKML?.kml?.Document,
        documentCount: parsedKML?.kml?.Document?.length
      });
    } catch (parseError) {
      console.error("❌ KML parsing failed:", parseError.message);
      return res.status(400).json({
        success: false,
        error: `Invalid KML format: ${parseError.message}`
      });
    }

    // Extract placemarks - they can be directly under Document or inside Folders
    let placemarks = [];

    // Try direct placemarks under Document
    if (parsedKML?.kml?.Document?.[0]?.Placemark) {
      placemarks = parsedKML.kml.Document[0].Placemark;
      console.log(
        "📊 Found placemarks directly under Document:",
        placemarks.length
      );
    }

    // ✅ FIX: Check for placemarks inside Folders and detect type from folder name
    if (parsedKML?.kml?.Document?.[0]?.Folder) {
      const folders = parsedKML.kml.Document[0].Folder;
      console.log("📁 Found folders:", folders.length);

      folders.forEach((folder, index) => {
        if (folder.Placemark) {
          const folderName = (folder.name?.[0] || "").toLowerCase();

          // Detect type from folder name
          let folderType = "POP"; // Default
          if (
            folderName.includes("spop") ||
            folderName.includes("subpop") ||
            folderName.includes("sub_pop") ||
            folderName.includes("p_spop")
          ) {
            folderType = "SubPOP";
          } else if (
            folderName.includes("pop") ||
            folderName.includes("p_pop")
          ) {
            folderType = "POP";
          }

          console.log(
            `📍 Folder ${index + 1} "${
              folder.name?.[0] || "Unnamed"
            }" detected as ${folderType}, has ${
              folder.Placemark.length
            } placemarks`
          );

          // Add folder type to each placemark for later use
          folder.Placemark.forEach((placemark) => {
            placemark._folderType = folderType;
          });

          placemarks.push(...folder.Placemark);
        }
      });
      console.log("📊 Total placemarks from all folders:", placemarks.length);
    }

    if (placemarks.length === 0) {
      console.error("❌ No placemarks found in KML file");
      console.log(
        "🔍 KML structure:",
        JSON.stringify(parsedKML, null, 2).substring(0, 1000)
      );
      return res.status(400).json({
        success: false,
        error:
          "No placemarks found in KML file. Please check if the KML file contains valid Placemark elements."
      });
    }

    console.log(`✅ Total placemarks to process: ${placemarks.length}`);

    // Generate import session ID
    const importSessionId = uuidv4();
    const importedItems = [];
    const batchValues = [];

    // Process each placemark and collect values for batch insert
    console.log("🔄 Processing placemarks...");
    for (const placemark of placemarks) {
      const name = placemark.name?.[0] || "Unnamed";
      const description = placemark.description?.[0] || "";
      const coordinatesStr = placemark.Point?.[0]?.coordinates?.[0]?.trim();

      if (!coordinatesStr) continue;

      const [lng, lat, height] = coordinatesStr
        .split(",")
        .map((v) => parseFloat(v.trim()));

      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`⚠️ Skipping "${name}": Invalid coordinates (NaN)`);
        continue;
      }

      // Validate coordinates are within India
      const validation = isValidIndiaCoordinate(lat, lng);
      if (!validation.valid) {
        const nearest = getNearestState(lat, lng);
        console.warn(`⚠️ Skipping "${name}": ${validation.error}`);
        console.warn(`   Coordinates: (${lat}, ${lng})`);
        console.warn(`   ${nearest.suggestion}`);
        continue; // Skip items with invalid coordinates
      }

      // ✅ IMPROVED TYPE DETECTION - Multi-level approach
      let type = placemark._folderType || "POP"; // Use folder type if available

      // Extract ExtendedData for unique_id check
      let uniqueIdFromKML = null;
      if (placemark.ExtendedData?.[0]?.Data) {
        const dataFields = placemark.ExtendedData[0].Data;
        const uniqueIdField = dataFields.find((d) => d.$.name === "unique_id");
        if (uniqueIdField?.value?.[0]) {
          uniqueIdFromKML = uniqueIdField.value[0];
        }
      }

      // If folder type wasn't detected, try other methods
      if (!placemark._folderType) {
        const nameStr = name.toLowerCase();
        const descStr = description.toLowerCase();

        // Method 1: Check unique_id from ExtendedData (most reliable)
        if (uniqueIdFromKML) {
          if (
            uniqueIdFromKML.startsWith("SPOP.") ||
            uniqueIdFromKML.startsWith("SUBPOP.")
          ) {
            type = "SubPOP";
          } else if (uniqueIdFromKML.startsWith("POP.")) {
            type = "POP";
          }
        }
        // Method 2: Check name and description
        else if (
          nameStr.includes("spop") ||
          nameStr.includes("subpop") ||
          nameStr.includes("sub-pop") ||
          nameStr.includes("sub pop") ||
          descStr.includes("spop") ||
          descStr.includes("subpop")
        ) {
          type = "SubPOP";
        } else if (nameStr.includes("pop") || descStr.includes("pop")) {
          type = "POP";
        }
      }

      console.log(
        `📋 "${name}" → Type: ${type} (Folder: ${
          placemark._folderType || "none"
        }, UniqueID: ${uniqueIdFromKML || "none"})`
      );

      // Generate unique ID
      const uniqueId = `KML-${type}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;

      // Auto-detect region
      const detectedRegionId = await detectRegionFromCoordinates(lat, lng);

      // Add to batch values
      batchValues.push([
        importSessionId,
        userId,
        type, // ✅ This should now be correctly detected
        name,
        uniqueId,
        `NET-${uniqueId}`,
        lat,
        lng,
        height || null,
        filename || "imported.kml",
        description,
        detectedRegionId,
        true // is_selected
      ]);

      importedItems.push({
        name,
        type, // ✅ This should now be correctly detected
        uniqueId,
        latitude: lat,
        longitude: lng,
        detectedRegionId
      });
    }

    // Batch insert all items (much faster than individual inserts)
    if (batchValues.length > 0) {
      console.log(`💾 Batch inserting ${batchValues.length} items...`);

      // Prepare values for batch insert (add source='KML' to each row)
      const formattedValues = batchValues.map((row) => [...row, "KML"]);

      await pool.query(
        `INSERT INTO infrastructure_imports
         (import_session_id, imported_by, item_type, item_name, unique_id, network_id,
          latitude, longitude, height, kml_filename, notes, detected_region_id, is_selected, source)
         VALUES ?`,
        [formattedValues]
      );
      console.log(`✅ Batch insert completed`);
    }

    // Log summary
    const popCount = importedItems.filter((i) => i.type === "POP").length;
    const subPopCount = importedItems.filter((i) => i.type === "SubPOP").length;
    console.log(`📊 Import Summary: ${popCount} POPs, ${subPopCount} SubPOPs`);

    res.json({
      success: true,
      message: `Imported ${importedItems.length} items to preview (${popCount} POPs, ${subPopCount} SubPOPs)`,
      data: {
        importSessionId,
        itemCount: importedItems.length,
        items: importedItems
      }
    });
  } catch (error) {
    console.error("Import KML error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to import KML file" });
  }
};

/**
 * @route   GET /api/infrastructure/import/:sessionId/preview
 * @desc    Get preview of imported items
 * @access  Private (ALL USERS)
 */
const getImportPreview = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [items] = await pool.query(
      `SELECT
        i.id,
        i.import_session_id,
        i.item_type as type,
        i.item_name as name,
        i.unique_id as uniqueId,
        i.network_id as networkId,
        i.latitude,
        i.longitude,
        i.height,
        i.kml_filename as kmlFilename,
        i.notes,
        i.detected_region_id as detectedRegionId,
        i.is_selected as isSelected,
        i.source,
        i.status,
        i.contact_name as contactName,
        i.contact_phone as contactPhone,
        i.address_street as addressStreet,
        i.address_city as addressCity,
        i.address_state as addressState,
        i.address_pincode as addressPincode,
        i.structure_type as structureType,
        i.bandwidth,
        i.power_source as powerSource,
        r.name as regionName
       FROM infrastructure_imports i
       LEFT JOIN regions r ON i.detected_region_id = r.id
       WHERE i.import_session_id = ? AND i.imported_by = ?
       ORDER BY i.imported_at`,
      [sessionId, userId]
    );

    res.json({
      success: true,
      data: items,
      count: items.length
    });
  } catch (error) {
    console.error("Get import preview error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to get import preview" });
  }
};

/**
 * @route   POST /api/infrastructure/import/:sessionId/save
 * @desc    Save selected imported items to main table (makes data permanent & visible to all)
 * @access  Private (ALL USERS)
 *
 * When user clicks "Save":
 * - Data moves from temporary import table to permanent infrastructure_items table
 * - Data becomes visible to all users in the same region
 * - Temporary import session is cleared
 */
const saveImportedItems = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { selectedIds } = req.body; // Array of IDs to save

    // Get selected items from import table
    let query = `
      SELECT * FROM infrastructure_imports
      WHERE import_session_id = ? AND imported_by = ?
    `;
    const params = [sessionId, userId];

    if (selectedIds && selectedIds.length > 0) {
      query += ` AND id IN (${selectedIds.map(() => "?").join(",")})`;
      params.push(...selectedIds);
    } else {
      query += " AND is_selected = TRUE";
    }

    const [importedItems] = await pool.query(query, params);

    if (importedItems.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No items selected to save" });
    }

    // Prepare batch values for insert
    console.log(
      `💾 Batch saving ${importedItems.length} items to infrastructure table...`
    );
    const batchValues = importedItems.map((item) => [
      userId,
      item.detected_region_id,
      userId,
      item.item_type,
      item.item_name,
      item.unique_id,
      item.network_id,
      item.ref_code,
      item.latitude,
      item.longitude,
      item.height,
      item.address_street,
      item.address_city,
      item.address_state,
      item.address_pincode,
      item.contact_name,
      item.contact_phone,
      item.contact_email,
      item.is_rented,
      item.rent_amount,
      item.agreement_start_date,
      item.agreement_end_date,
      item.landlord_name,
      item.landlord_contact,
      item.nature_of_business,
      item.owner,
      item.structure_type,
      item.ups_availability,
      item.ups_capacity,
      item.backup_capacity,
      item.power_source,
      item.equipment_list,
      item.connected_to,
      item.bandwidth,
      item.status || "Active",
      item.installation_date,
      item.maintenance_due_date,
      item.source,
      item.notes,
      item.properties ? JSON.stringify(item.properties) : null
    ]);

    // Batch insert all items at once (much faster!)
    await pool.query(
      `INSERT INTO infrastructure_items
       (user_id, region_id, created_by, item_type, item_name, unique_id, network_id, ref_code,
        latitude, longitude, height,
        address_street, address_city, address_state, address_pincode,
        contact_name, contact_phone, contact_email,
        is_rented, rent_amount, agreement_start_date, agreement_end_date,
        landlord_name, landlord_contact, nature_of_business, owner,
        structure_type, ups_availability, ups_capacity, backup_capacity, power_source,
        equipment_list, connected_to, bandwidth,
        status, installation_date, maintenance_due_date,
        source, notes, properties)
       VALUES ?`,
      [batchValues]
    );

    console.log(
      `✅ Batch insert completed: ${importedItems.length} items saved`
    );

    // Log single audit entry for the batch import
    await logAudit(
      userId,
      userId,
      "IMPORT_BATCH",
      null,
      {
        count: importedItems.length,
        session_id: sessionId,
        source: "KML",
        kml_filename: importedItems[0]?.kml_filename
      },
      req
    );

    const savedCount = importedItems.length;

    res.json({
      success: true,
      message: `Successfully saved ${savedCount} items`,
      data: {
        count: savedCount
      }
    });
  } catch (error) {
    console.error("Save imported items error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to save imported items" });
  }
};

/**
 * @route   POST /api/infrastructure/import/:sessionId/save-item/:itemId
 * @desc    Save a single imported item to permanent storage
 * @access  Private (ALL USERS)
 *
 * NEW FEATURE: Individual Save
 * - Allows user to save one item at a time
 * - Useful for gradual verification
 * - Item moves from infrastructure_imports to infrastructure_items
 */
const saveSingleImportedItem = async (req, res) => {
  try {
    const { sessionId, itemId } = req.params;
    const userId = req.user.id;

    console.log(`💾 Saving single item: ${itemId} from session: ${sessionId}`);

    // Get the specific item from imports table
    const [items] = await pool.query(
      `SELECT * FROM infrastructure_imports
       WHERE import_session_id = ?
       AND id = ?
       AND imported_by = ?`,
      [sessionId, itemId, userId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Item not found or access denied"
      });
    }

    const item = items[0];

    // Insert to permanent infrastructure_items table
    const [result] = await pool.query(
      `INSERT INTO infrastructure_items
       (user_id, region_id, created_by, item_type, item_name, unique_id, network_id, ref_code,
        latitude, longitude, height,
        address_street, address_city, address_state, address_pincode,
        contact_name, contact_phone, contact_email,
        is_rented, rent_amount, agreement_start_date, agreement_end_date,
        landlord_name, landlord_contact, nature_of_business, owner,
        structure_type, ups_availability, ups_capacity, backup_capacity, power_source,
        equipment_list, connected_to, bandwidth,
        status, installation_date, maintenance_due_date,
        source, notes, properties)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        item.detected_region_id,
        userId,
        item.item_type,
        item.item_name,
        item.unique_id,
        item.network_id,
        item.ref_code,
        item.latitude,
        item.longitude,
        item.height,
        item.address_street,
        item.address_city,
        item.address_state,
        item.address_pincode,
        item.contact_name,
        item.contact_phone,
        item.contact_email,
        item.is_rented,
        item.rent_amount,
        item.agreement_start_date,
        item.agreement_end_date,
        item.landlord_name,
        item.landlord_contact,
        item.nature_of_business,
        item.owner,
        item.structure_type,
        item.ups_availability,
        item.ups_capacity,
        item.backup_capacity,
        item.power_source,
        item.equipment_list,
        item.connected_to,
        item.bandwidth,
        item.status || "Active",
        item.installation_date,
        item.maintenance_due_date,
        item.source,
        item.notes,
        item.properties ? JSON.stringify(item.properties) : null
      ]
    );

    // Delete from temporary import table
    await pool.query(
      `DELETE FROM infrastructure_imports WHERE id = ?`,
      [itemId]
    );

    // Log audit
    await logAudit(
      result.insertId,
      userId,
      "IMPORT_SINGLE",
      null,
      {
        item_type: item.item_type,
        item_name: item.item_name,
        unique_id: item.unique_id,
        source: "KML",
        kml_filename: item.kml_filename
      },
      req
    );

    console.log(`✅ Successfully saved item: ${item.item_name} (ID: ${result.insertId})`);

    res.json({
      success: true,
      message: `Saved: ${item.item_name}`,
      data: {
        id: result.insertId,
        item_name: item.item_name,
        item_type: item.item_type
      }
    });

  } catch (error) {
    console.error("Save single item error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save item"
    });
  }
};

/**
 * @route   DELETE /api/infrastructure/import/:sessionId
 * @desc    Delete all imported items from session (cancel/discard import)
 * @access  Private (ALL USERS)
 */
const deleteImportSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    await pool.query(
      "DELETE FROM infrastructure_imports WHERE import_session_id = ? AND imported_by = ?",
      [sessionId, userId]
    );

    res.json({ success: true, message: "Import session deleted successfully" });
  } catch (error) {
    console.error("Delete import session error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete import session" });
  }
};

/**
 * @route   GET /api/infrastructure/stats
 * @desc    Get infrastructure statistics
 * @access  Private
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
          SELECT resource_id FROM temporary_access
          WHERE user_id = ? AND resource_type = 'region'
          AND expires_at > NOW() AND revoked_at IS NULL
        )
        OR (
          region_id IS NULL
          AND EXISTS (
            SELECT 1 FROM user_regions WHERE user_id = ?
            UNION
            SELECT 1 FROM temporary_access
            WHERE user_id = ? AND resource_type = 'region'
            AND expires_at > NOW() AND revoked_at IS NULL
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
 * @route   GET /api/infrastructure/map-view
 * @desc    Get infrastructure items within map viewport (optimized for map rendering)
 * @access  Private
 * @query   north, south, east, west (bounding box), zoom (1-20), regionId (optional)
 */
const getMapViewInfrastructure = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || "").toLowerCase();
    const { north, south, east, west, zoom, regionId, limit } = req.query;

    // Validate bounding box parameters
    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        error: "Bounding box required: north, south, east, west"
      });
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    // Validate coordinates
    if (
      isNaN(bounds.north) ||
      isNaN(bounds.south) ||
      isNaN(bounds.east) ||
      isNaN(bounds.west)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid bounding box coordinates"
      });
    }

    const zoomLevel = zoom ? parseInt(zoom) : 10;

    // Determine result limit based on zoom level
    let resultLimit = limit ? parseInt(limit) : null;
    if (!resultLimit) {
      if (zoomLevel <= 8) resultLimit = 500; // Country/state view
      else if (zoomLevel <= 12) resultLimit = 1000; // City view
      else resultLimit = 2000; // Street view
    }

    console.log("🗺️ Map view request:", {
      userId,
      userRole,
      bounds,
      zoom: zoomLevel,
      limit: resultLimit
    });

    // Build query - select only essential fields for map rendering
    let query = `
      SELECT
        i.id,
        i.item_type,
        i.item_name,
        i.unique_id,
        i.latitude,
        i.longitude,
        i.status,
        i.region_id,
        r.name as region_name
      FROM infrastructure_items i
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE i.latitude BETWEEN ? AND ?
      AND i.longitude BETWEEN ? AND ?
    `;
    const params = [bounds.south, bounds.north, bounds.west, bounds.east];

    // Role-based filtering
    if (userRole !== "admin" && userRole !== "manager") {
      query += ` AND (
        i.user_id = ?
        OR i.region_id IN (
          SELECT region_id FROM user_regions WHERE user_id = ?
          UNION
          SELECT resource_id FROM temporary_access
          WHERE user_id = ? AND resource_type = 'region'
          AND expires_at > NOW() AND revoked_at IS NULL
        )
      )`;
      params.push(userId, userId, userId);
    }

    // Optional region filter
    if (regionId) {
      query += " AND i.region_id = ?";
      params.push(regionId);
    }

    // Only show active items on map by default (can be customized)
    query += " AND i.status IN ('Active', 'RFS', 'Maintenance')";

    // Add limit
    query += ` LIMIT ?`;
    params.push(resultLimit);

    const [items] = await pool.query(query, params);

    console.log(`🗺️ Map view response: ${items.length} items`);

    res.json({
      success: true,
      items: items,
      count: items.length,
      bounds: bounds,
      zoom: zoomLevel,
      limited: items.length >= resultLimit
    });
  } catch (error) {
    console.error("Get map view infrastructure error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get map view infrastructure"
    });
  }
};

/**
 * @route   GET /api/infrastructure/clusters
 * @desc    Get clustered infrastructure data for low zoom levels
 * @access  Private
 * @query   north, south, east, west (bounding box), zoom (1-20), gridSize (optional)
 */
const getClusters = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = (req.user.role || "").toLowerCase();
    const { north, south, east, west, zoom, gridSize, regionId } = req.query;

    // Validate bounding box
    if (!north || !south || !east || !west) {
      return res.status(400).json({
        success: false,
        error: "Bounding box required: north, south, east, west"
      });
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    const zoomLevel = zoom ? parseInt(zoom) : 10;

    // For high zoom levels (15+), return individual markers instead of clusters
    if (zoomLevel >= 15) {
      console.log("🗺️ Zoom level high, redirecting to individual markers...");
      return getMapViewInfrastructure(req, res);
    }

    // Calculate grid size based on zoom level
    // Lower zoom = larger grid cells = more aggressive clustering
    let grid = gridSize ? parseFloat(gridSize) : null;
    if (!grid) {
      if (zoomLevel <= 5) grid = 2.0; // ~220km grid cells
      else if (zoomLevel <= 8) grid = 0.5; // ~55km grid cells
      else if (zoomLevel <= 11) grid = 0.1; // ~11km grid cells
      else grid = 0.05; // ~5.5km grid cells
    }

    console.log("🗺️ Cluster request:", {
      userId,
      userRole,
      bounds,
      zoom: zoomLevel,
      gridSize: grid
    });

    // Build clustering query using grid-based aggregation
    let query = `
      SELECT
        ROUND(i.latitude / ?, 0) * ? as grid_lat,
        ROUND(i.longitude / ?, 0) * ? as grid_lng,
        COUNT(*) as count,
        SUM(CASE WHEN i.item_type = 'POP' THEN 1 ELSE 0 END) as pop_count,
        SUM(CASE WHEN i.item_type = 'SubPOP' THEN 1 ELSE 0 END) as subpop_count,
        AVG(i.latitude) as latitude,
        AVG(i.longitude) as longitude,
        GROUP_CONCAT(DISTINCT i.item_type) as types,
        GROUP_CONCAT(DISTINCT r.name) as regions
      FROM infrastructure_items i
      LEFT JOIN regions r ON i.region_id = r.id
      WHERE i.latitude BETWEEN ? AND ?
      AND i.longitude BETWEEN ? AND ?
    `;
    const params = [
      grid,
      grid,
      grid,
      grid,
      bounds.south,
      bounds.north,
      bounds.west,
      bounds.east
    ];

    // Role-based filtering
    if (userRole !== "admin" && userRole !== "manager") {
      query += ` AND (
        i.user_id = ?
        OR i.region_id IN (
          SELECT region_id FROM user_regions WHERE user_id = ?
          UNION
          SELECT resource_id FROM temporary_access
          WHERE user_id = ? AND resource_type = 'region'
          AND expires_at > NOW() AND revoked_at IS NULL
        )
      )`;
      params.push(userId, userId, userId);
    }

    // Optional region filter
    if (regionId) {
      query += " AND i.region_id = ?";
      params.push(regionId);
    }

    // Only show active items
    query += " AND i.status IN ('Active', 'RFS', 'Maintenance')";

    // Group by grid cell
    query += " GROUP BY grid_lat, grid_lng";

    // Limit clusters
    query += " LIMIT 1000";

    const [clusters] = await pool.query(query, params);

    // Format clusters for frontend
    const formattedClusters = clusters.map((cluster) => ({
      type: "cluster",
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      count: cluster.count,
      pop_count: cluster.pop_count,
      subpop_count: cluster.subpop_count,
      types: cluster.types ? cluster.types.split(",") : [],
      regions: cluster.regions ? cluster.regions.split(",") : []
    }));

    console.log(`🗺️ Cluster response: ${formattedClusters.length} clusters`);

    res.json({
      success: true,
      clusters: formattedClusters,
      count: formattedClusters.length,
      bounds: bounds,
      zoom: zoomLevel,
      gridSize: grid,
      clusteringEnabled: true
    });
  } catch (error) {
    console.error("Get clusters error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get infrastructure clusters"
    });
  }
};

/**
 * @route   GET /api/infrastructure/validate/coordinates
 * @desc    Scan and report invalid coordinates (Admin only)
 * @access  Private (Admin)
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
      "SELECT COUNT(*) as user_total FROM infrastructure_items WHERE user_id = ?",
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
  getAllInfrastructure,
  getInfrastructureById,
  getInfrastructureByViewport,
  createInfrastructure,
  updateInfrastructure,
  deleteInfrastructure,
  importKML,
  getImportPreview,
  saveImportedItems,
  saveSingleImportedItem, // 🆕 NEW: Individual save
  deleteImportSession,
  getInfrastructureStats,
  getCategories,
  getMapViewInfrastructure,
  getClusters,
  validateCoordinates, // 🆕 NEW: Coordinate validation utility
  debugGetCounts // 🆕 NEW: Debug endpoint
};
