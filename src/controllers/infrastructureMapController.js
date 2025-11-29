const { pool } = require("../config/database");

/**
 * @route   GET /api/infrastructure/map-view
 * @desc    Get infrastructure items within map viewport (optimized for map rendering)
 * @access  Private
 * @query   north, south, east, west (bounding box), zoom (1-20), regionId (optional)
 *
 * Returns only essential fields for map markers to minimize data transfer.
 * Includes role-based filtering and zoom-level aware result limiting.
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
        i.created_by = ?
        OR i.region_id IN (
          SELECT region_id FROM user_regions WHERE user_id = ?
          UNION
          SELECT region_id FROM temporary_access_log
          WHERE user_id = ?
          AND end_time > NOW() AND status != 'revoked'
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
 *
 * Performance optimization for low zoom levels:
 * - Groups markers into grid-based clusters
 * - Reduces marker count from 100K+ to hundreds of clusters
 * - Grid size automatically adjusts based on zoom level
 * - For zoom >= 15, redirects to individual marker view
 *
 * Clustering Algorithm:
 * - Grid-based spatial aggregation using ROUND(lat/grid) * grid
 * - Lower zoom = larger grid cells = more aggressive clustering
 * - Returns cluster center point (average coordinates) and item counts
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
        i.created_by = ?
        OR i.region_id IN (
          SELECT region_id FROM user_regions WHERE user_id = ?
          UNION
          SELECT region_id FROM temporary_access_log
          WHERE user_id = ?
          AND end_time > NOW() AND status != 'revoked'
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

module.exports = {
  getMapViewInfrastructure,
  getClusters
};
