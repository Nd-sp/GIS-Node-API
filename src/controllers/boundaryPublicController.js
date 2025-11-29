const { pool } = require("../config/database");

/**
 * @route   GET /api/boundaries/published
 * @desc    Get published boundaries based on user's assigned regions
 * @access  Private (All authenticated users - filtered by region assignments)
 */
const getAllPublishedBoundaries = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`📍 Fetching published boundaries for user ${userId} (${userRole})...`);

    let boundaries;

    // Admin sees all published boundaries
    if (userRole === 'admin') {
      console.log('👑 Admin user - fetching all published boundaries');
      [boundaries] = await pool.query(
        `SELECT
          bv.id,
          bv.region_id,
          bv.boundary_geojson,
          bv.boundary_type,
          bv.vertex_count,
          bv.area_sqkm,
          bv.version_number,
          bv.published_at,
          bv.published_by,
          r.name as region_name,
          r.code as region_code,
          r.type as region_type
        FROM boundary_versions bv
        JOIN regions r ON bv.region_id = r.id
        WHERE bv.status = 'published'
        ORDER BY r.name ASC`,
        []
      );
    } else {
      // Non-admin users see only boundaries for their assigned regions
      console.log('👤 Regular user - fetching boundaries for assigned regions only');
      [boundaries] = await pool.query(
        `SELECT
          bv.id,
          bv.region_id,
          bv.boundary_geojson,
          bv.boundary_type,
          bv.vertex_count,
          bv.area_sqkm,
          bv.version_number,
          bv.published_at,
          bv.published_by,
          r.name as region_name,
          r.code as region_code,
          r.type as region_type
        FROM boundary_versions bv
        JOIN regions r ON bv.region_id = r.id
        INNER JOIN user_regions ur ON ur.region_id = bv.region_id
        WHERE bv.status = 'published'
          AND ur.user_id = ?
        ORDER BY r.name ASC`,
        [userId]
      );
    }

    console.log(`✅ Found ${boundaries.length} published boundaries for user ${userId}`);

    // Transform to frontend-friendly format
    const boundariesData = boundaries.map((b) => ({
      regionId: b.region_id,
      regionName: b.region_name,
      regionCode: b.region_code,
      regionType: b.region_type,
      boundaryGeoJSON:
        typeof b.boundary_geojson === "string"
          ? JSON.parse(b.boundary_geojson)
          : b.boundary_geojson,
      boundaryType: b.boundary_type,
      vertexCount: b.vertex_count,
      areaSqKm: b.area_sqkm,
      versionNumber: b.version_number,
      publishedAt: b.published_at,
      publishedBy: b.published_by,
    }));

    res.json({
      success: true,
      count: boundariesData.length,
      boundaries: boundariesData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error fetching published boundaries:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch published boundaries",
      details: error.message,
    });
  }
};

/**
 * @route   GET /api/boundaries/export
 * @desc    Export all published boundaries as india.json format for fallback/backup
 * @access  Private (Admin only)
 */
const exportBoundariesAsJSON = async (req, res) => {
  try {
    console.log("📥 Exporting all published boundaries as JSON...");

    // Only admin can export
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Only administrators can export boundaries",
      });
    }

    // Query all published boundaries from DB
    const [publishedBoundaries] = await pool.query(
      `SELECT
        bv.region_id,
        bv.boundary_geojson,
        bv.boundary_type,
        bv.version_number,
        r.name as region_name,
        r.code as region_code,
        r.type as region_type
      FROM boundary_versions bv
      JOIN regions r ON bv.region_id = r.id
      WHERE bv.status = 'published'
      ORDER BY r.name ASC`,
      []
    );

    // Query ALL regions from DB (even those without published boundaries)
    const [allRegions] = await pool.query(
      `SELECT id, name, code, type FROM regions ORDER BY name ASC`,
      []
    );

    console.log(`✅ Found ${publishedBoundaries.length} published boundaries and ${allRegions.length} total regions`);

    // Helper function to calculate centroid from GeoJSON
    const calculateCentroid = (geometry) => {
      if (!geometry || !geometry.coordinates) return [78.9629, 20.5937]; // Default India center

      let coords = geometry.coordinates;
      // Handle MultiPolygon: use first polygon
      if (geometry.type === 'MultiPolygon') {
        coords = coords[0]; // Get first polygon
      }
      // Get outer ring coordinates
      const ring = coords[0];

      if (!ring || ring.length === 0) return [78.9629, 20.5937];

      // Calculate simple centroid (average of all points)
      let sumLng = 0, sumLat = 0, count = 0;
      ring.forEach(([lng, lat]) => {
        sumLng += lng;
        sumLat += lat;
        count++;
      });

      return [sumLng / count, sumLat / count];
    };

    // Load india.json as fallback for missing regions
    let indiaData = null;
    try {
      const fs = require('fs');
      const path = require('path');
      const indiaJsonPath = path.join(__dirname, '../../public/india.json');

      if (fs.existsSync(indiaJsonPath)) {
        const indiaJsonContent = fs.readFileSync(indiaJsonPath, 'utf8');
        indiaData = JSON.parse(indiaJsonContent);
        console.log(`✅ Loaded india.json fallback (${indiaData.features?.length || 0} features)`);
      } else {
        console.log('⚠️  india.json not found, will only export published boundaries');
      }
    } catch (fallbackError) {
      console.error('⚠️  Failed to load india.json fallback:', fallbackError);
    }

    // Transform to india.json FeatureCollection format
    // For each region: use DB boundary if exists, else use india.json fallback
    const features = allRegions.map((region) => {
      // Check if this region has a published boundary in DB
      const publishedBoundary = publishedBoundaries.find(b => b.region_id === region.id);

      if (publishedBoundary) {
        // Use corrected boundary from DB
        const geojson =
          typeof publishedBoundary.boundary_geojson === "string"
            ? JSON.parse(publishedBoundary.boundary_geojson)
            : publishedBoundary.boundary_geojson;

        const center = calculateCentroid(geojson);

        return {
          type: "Feature",
          properties: {
            id: publishedBoundary.region_id,
            name: publishedBoundary.region_name,
            code: publishedBoundary.region_code,
            type: publishedBoundary.region_type,
            version: publishedBoundary.version_number,
            center: center,
            source: 'database', // Mark as corrected from DB
          },
          geometry: geojson,
        };
      } else if (indiaData && indiaData.features) {
        // Use original boundary from india.json
        const indiaFeature = indiaData.features.find(f =>
          f.properties?.name === region.name ||
          f.properties?.st_nm === region.name
        );

        if (indiaFeature) {
          const center = calculateCentroid(indiaFeature.geometry);
          return {
            type: "Feature",
            properties: {
              id: region.id,
              name: region.name,
              code: region.code,
              type: region.type,
              version: 0, // Original version
              center: center,
              source: 'india.json', // Mark as fallback
            },
            geometry: indiaFeature.geometry,
          };
        }
      }

      // If no data found anywhere, return null (will be filtered out)
      console.warn(`⚠️  No boundary data found for region: ${region.name} (ID: ${region.id})`);
      return null;
    }).filter(f => f !== null); // Remove nulls

    const dbBoundariesCount = features.filter(f => f.properties.source === 'database').length;
    const fallbackBoundariesCount = features.filter(f => f.properties.source === 'india.json').length;

    const geoJsonExport = {
      type: "FeatureCollection",
      features: features,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.id,
        totalRegions: features.length,
        correctedBoundaries: dbBoundariesCount,
        originalBoundaries: fallbackBoundariesCount,
        source: "OptiConnect GIS - Boundary Versioning System (Mixed DB + india.json)",
        note: `Exported ${dbBoundariesCount} corrected boundaries from database and ${fallbackBoundariesCount} original boundaries from india.json fallback`
      },
    };

    console.log(`✅ Export includes ${dbBoundariesCount} corrected + ${fallbackBoundariesCount} original = ${features.length} total`);

    // Set headers for file download
    const filename = `india-boundaries-${new Date().toISOString().split("T")[0]}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    // Send as string for proper blob download
    res.send(JSON.stringify(geoJsonExport, null, 2));

    console.log("✅ Boundaries exported successfully");
  } catch (error) {
    console.error("❌ Error exporting boundaries:", error);
    res.status(500).json({
      success: false,
      error: "Failed to export boundaries",
      details: error.message,
    });
  }
};

module.exports = {
  getAllPublishedBoundaries,
  exportBoundariesAsJSON,
};
