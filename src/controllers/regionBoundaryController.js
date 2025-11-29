const { pool } = require('../config/database');

/**
 * @route   GET /api/regions/:regionId/boundary
 * @desc    Get current PUBLISHED boundary for a region (using new boundary_versions system)
 *          Falls back to india.json if no boundary exists in DB
 * @access  Private
 */
const getRegionBoundary = async (req, res) => {
  try {
    const { id: regionId } = req.params;

    // Query the NEW boundary_versions table for PUBLISHED boundaries only
    const [boundaries] = await pool.query(
      `SELECT
        bv.id,
        bv.region_id,
        bv.boundary_geojson,
        bv.boundary_type,
        bv.version_number,
        bv.vertex_count,
        bv.area_sqkm,
        bv.created_by,
        bv.created_at,
        bv.published_at,
        bv.published_by,
        bv.source,
        bv.notes,
        bv.change_reason,
        u1.full_name as created_by_name,
        u2.full_name as published_by_name
      FROM boundary_versions bv
      LEFT JOIN users u1 ON bv.created_by = u1.id
      LEFT JOIN users u2 ON bv.published_by = u2.id
      WHERE bv.region_id = ? AND bv.status = 'published'
      ORDER BY bv.published_at DESC
      LIMIT 1`,
      [regionId]
    );

    if (boundaries.length === 0) {
      // No boundary in DB - try to load from india.json as fallback
      try {
        const fs = require('fs');
        const path = require('path');
        const indiaJsonPath = path.join(__dirname, '../../public/india.json');

        if (fs.existsSync(indiaJsonPath)) {
          const indiaData = JSON.parse(fs.readFileSync(indiaJsonPath, 'utf8'));

          // Find the region in india.json by matching region ID
          const [regions] = await pool.query('SELECT id, name, code FROM regions WHERE id = ?', [regionId]);

          if (regions.length > 0) {
            const region = regions[0];

            // Find matching feature in india.json (match by region ID or name/st_nm)
            const feature = indiaData.features.find(
              (f) =>
                f.properties.id === parseInt(regionId) ||
                f.properties.name === region.name ||
                f.properties.st_nm === region.name
            );

            if (feature) {
              console.log(`📍 Fallback: Loading boundary for region ${region.name} from india.json`);

              // Count vertices
              let vertexCount = 0;
              if (feature.geometry.type === 'Polygon') {
                feature.geometry.coordinates.forEach((ring) => {
                  vertexCount += ring.length;
                });
              } else if (feature.geometry.type === 'MultiPolygon') {
                feature.geometry.coordinates.forEach((polygon) => {
                  polygon.forEach((ring) => {
                    vertexCount += ring.length;
                  });
                });
              }

              return res.json({
                success: true,
                boundary: {
                  id: null, // No DB record
                  regionId: parseInt(regionId),
                  boundaryGeojson: feature.geometry,
                  boundaryType: feature.geometry.type,
                  version: 1,
                  vertexCount: vertexCount,
                  areaSqkm: 0,
                  createdBy: null,
                  createdByName: 'System',
                  publishedBy: null,
                  publishedByName: 'Static File',
                  createdAt: null,
                  publishedAt: null,
                  isActive: true,
                  source: 'india.json',
                  notes: 'Loaded from static file',
                  changeReason: null,
                },
              });
            }
          }
        }
      } catch (fallbackError) {
        console.error('Fallback to india.json failed:', fallbackError);
      }

      // No boundary in DB and fallback failed
      return res.status(404).json({
        success: false,
        error: 'No published boundary found for this region',
      });
    }

    const boundary = boundaries[0];

    res.json({
      success: true,
      boundary: {
        id: boundary.id,
        regionId: boundary.region_id,
        boundaryGeojson: boundary.boundary_geojson,
        boundaryType: boundary.boundary_type,
        version: boundary.version_number,
        vertexCount: boundary.vertex_count,
        areaSqkm: boundary.area_sqkm,
        createdBy: boundary.created_by,
        createdByName: boundary.created_by_name,
        publishedBy: boundary.published_by,
        publishedByName: boundary.published_by_name,
        createdAt: boundary.created_at,
        publishedAt: boundary.published_at,
        isActive: true, // Published boundaries are always "active"
        source: boundary.source,
        notes: boundary.notes,
        changeReason: boundary.change_reason,
      },
    });
  } catch (error) {
    console.error('Get region boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get region boundary',
    });
  }
};

/**
 * @route   GET /api/regions/:regionId/boundaries
 * @desc    Get all boundary versions for a region (history)
 * @access  Private (Admin/Manager)
 */
const getRegionBoundaryHistory = async (req, res) => {
  try {
    const { id: regionId } = req.params;

    const [boundaries] = await pool.query(
      `SELECT
        rb.id,
        rb.region_id,
        rb.boundary_type,
        rb.version,
        rb.vertex_count,
        rb.area_sqkm,
        rb.created_by,
        rb.created_at,
        rb.is_active,
        rb.source,
        rb.notes,
        u.full_name as created_by_name
      FROM region_boundaries rb
      LEFT JOIN users u ON rb.created_by = u.id
      WHERE rb.region_id = ?
      ORDER BY rb.version DESC`,
      [regionId]
    );

    res.json({
      success: true,
      boundaries: boundaries.map(b => ({
        id: b.id,
        regionId: b.region_id,
        type: b.boundary_type,
        version: b.version,
        vertexCount: b.vertex_count,
        areaSqKm: b.area_sqkm,
        createdBy: b.created_by,
        createdByName: b.created_by_name,
        createdAt: b.created_at,
        isActive: b.is_active,
        source: b.source,
        notes: b.notes
      })),
      total: boundaries.length
    });

  } catch (error) {
    console.error('Get region boundary history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get boundary history'
    });
  }
};

/**
 * @route   PUT /api/regions/:regionId/boundary
 * @desc    Update region boundary (creates new version)
 * @access  Private (Admin/Manager)
 */
const updateRegionBoundary = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { boundaryGeoJSON, changeReason, source, notes } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!boundaryGeoJSON || !boundaryGeoJSON.type || !boundaryGeoJSON.coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GeoJSON format. Must include type and coordinates.'
      });
    }

    // Validate GeoJSON type
    if (!['Polygon', 'MultiPolygon'].includes(boundaryGeoJSON.type)) {
      return res.status(400).json({
        success: false,
        error: 'Boundary type must be Polygon or MultiPolygon'
      });
    }

    // Calculate vertex count
    let vertexCount = 0;
    if (boundaryGeoJSON.type === 'Polygon') {
      boundaryGeoJSON.coordinates.forEach(ring => {
        vertexCount += ring.length;
      });
    } else if (boundaryGeoJSON.type === 'MultiPolygon') {
      boundaryGeoJSON.coordinates.forEach(polygon => {
        polygon.forEach(ring => {
          vertexCount += ring.length;
        });
      });
    }

    // Get current active boundary (for history)
    const [currentBoundaries] = await pool.query(
      'SELECT * FROM region_boundaries WHERE region_id = ? AND is_active = TRUE LIMIT 1',
      [regionId]
    );

    const currentBoundary = currentBoundaries[0];
    const newVersion = currentBoundary ? currentBoundary.version + 1 : 1;

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deactivate old boundary
      if (currentBoundary) {
        await connection.query(
          'UPDATE region_boundaries SET is_active = FALSE WHERE id = ?',
          [currentBoundary.id]
        );
      }

      // Insert new boundary version
      const [result] = await connection.query(
        `INSERT INTO region_boundaries
         (region_id, boundary_geojson, boundary_type, version, vertex_count, created_by, source, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          regionId,
          JSON.stringify(boundaryGeoJSON),
          boundaryGeoJSON.type,
          newVersion,
          vertexCount,
          userId,
          source || 'Manual Edit',
          notes || null
        ]
      );

      const newBoundaryId = result.insertId;

      // Calculate change statistics
      let verticesAdded = 0;
      let verticesRemoved = 0;
      let verticesMoved = 0;

      if (currentBoundary) {
        const oldVertexCount = currentBoundary.vertex_count || 0;
        const diff = vertexCount - oldVertexCount;
        if (diff > 0) {
          verticesAdded = diff;
        } else if (diff < 0) {
          verticesRemoved = Math.abs(diff);
        } else {
          verticesMoved = vertexCount; // Assume all moved if count is same
        }
      } else {
        verticesAdded = vertexCount; // All vertices are new
      }

      // Insert change history
      await connection.query(
        `INSERT INTO boundary_change_history
         (region_id, boundary_id, old_boundary, new_boundary, old_version, new_version,
          change_type, change_reason, vertices_added, vertices_removed, vertices_moved,
          changed_by, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          regionId,
          newBoundaryId,
          currentBoundary ? JSON.stringify(currentBoundary.boundary_geojson) : null,
          JSON.stringify(boundaryGeoJSON),
          currentBoundary ? currentBoundary.version : null,
          newVersion,
          currentBoundary ? 'edited' : 'created',
          changeReason || 'Boundary correction',
          verticesAdded,
          verticesRemoved,
          verticesMoved,
          userId,
          req.ip,
          req.headers['user-agent']
        ]
      );

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'UPDATE_BOUNDARY',
          'region',
          regionId,
          JSON.stringify({
            oldVersion: currentBoundary ? currentBoundary.version : null,
            newVersion: newVersion,
            verticesAdded,
            verticesRemoved,
            verticesMoved,
            changeReason: changeReason || 'Boundary correction'
          }),
          req.ip
        ]
      );

      // Commit transaction
      await connection.commit();

      res.json({
        success: true,
        message: 'Region boundary updated successfully',
        boundary: {
          id: newBoundaryId,
          regionId: parseInt(regionId),
          version: newVersion,
          vertexCount: vertexCount,
          type: boundaryGeoJSON.type,
          changeStats: {
            verticesAdded,
            verticesRemoved,
            verticesMoved
          }
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Update region boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update region boundary',
      details: error.message
    });
  }
};

/**
 * @route   GET /api/regions/:regionId/boundary-changes
 * @desc    Get change history for a region boundary
 * @access  Private (Admin/Manager)
 */
const getBoundaryChangeHistory = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [changes] = await pool.query(
      `SELECT
        bch.id,
        bch.region_id,
        bch.boundary_id,
        bch.old_version,
        bch.new_version,
        bch.change_type,
        bch.change_reason,
        bch.vertices_added,
        bch.vertices_removed,
        bch.vertices_moved,
        bch.changed_by,
        bch.changed_at,
        bch.ip_address,
        u.full_name as changed_by_name,
        u.username as changed_by_username
      FROM boundary_change_history bch
      LEFT JOIN users u ON bch.changed_by = u.id
      WHERE bch.region_id = ?
      ORDER BY bch.changed_at DESC
      LIMIT ? OFFSET ?`,
      [regionId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM boundary_change_history WHERE region_id = ?',
      [regionId]
    );

    res.json({
      success: true,
      changes: changes.map(ch => ({
        id: ch.id,
        regionId: ch.region_id,
        boundaryId: ch.boundary_id,
        oldVersion: ch.old_version,
        newVersion: ch.new_version,
        changeType: ch.change_type,
        changeReason: ch.change_reason,
        verticesAdded: ch.vertices_added,
        verticesRemoved: ch.vertices_removed,
        verticesMoved: ch.vertices_moved,
        changedBy: ch.changed_by,
        changedByName: ch.changed_by_name,
        changedByUsername: ch.changed_by_username,
        changedAt: ch.changed_at,
        ipAddress: ch.ip_address
      })),
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Get boundary change history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get change history'
    });
  }
};

/**
 * @route   POST /api/regions/:regionId/boundary/revert/:version
 * @desc    Revert boundary to a previous version
 * @access  Private (Admin only)
 */
const revertBoundaryToVersion = async (req, res) => {
  try {
    const { id: regionId, version } = req.params;
    const { changeReason } = req.body;
    const userId = req.user.id;

    // Get the specified version
    const [targetBoundaries] = await pool.query(
      'SELECT * FROM region_boundaries WHERE region_id = ? AND version = ? LIMIT 1',
      [regionId, parseInt(version)]
    );

    if (targetBoundaries.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Version ${version} not found for this region`
      });
    }

    const targetBoundary = targetBoundaries[0];

    // Get current active boundary
    const [currentBoundaries] = await pool.query(
      'SELECT * FROM region_boundaries WHERE region_id = ? AND is_active = TRUE LIMIT 1',
      [regionId]
    );

    if (currentBoundaries.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active boundary found'
      });
    }

    const currentBoundary = currentBoundaries[0];

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Deactivate current boundary
      await connection.query(
        'UPDATE region_boundaries SET is_active = FALSE WHERE id = ?',
        [currentBoundary.id]
      );

      // Create new version with reverted boundary
      const newVersion = currentBoundary.version + 1;
      const [result] = await connection.query(
        `INSERT INTO region_boundaries
         (region_id, boundary_geojson, boundary_type, version, vertex_count, created_by, source, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          regionId,
          JSON.stringify(targetBoundary.boundary_geojson),
          targetBoundary.boundary_type,
          newVersion,
          targetBoundary.vertex_count,
          userId,
          `Reverted to version ${version}`,
          `Reverted from version ${currentBoundary.version} to version ${version}`
        ]
      );

      const newBoundaryId = result.insertId;

      // Insert change history
      await connection.query(
        `INSERT INTO boundary_change_history
         (region_id, boundary_id, old_boundary, new_boundary, old_version, new_version,
          change_type, change_reason, changed_by, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          regionId,
          newBoundaryId,
          JSON.stringify(currentBoundary.boundary_geojson),
          JSON.stringify(targetBoundary.boundary_geojson),
          currentBoundary.version,
          newVersion,
          'reverted',
          changeReason || `Reverted to version ${version}`,
          userId,
          req.ip,
          req.headers['user-agent']
        ]
      );

      // Commit transaction
      await connection.commit();

      res.json({
        success: true,
        message: `Boundary reverted to version ${version}`,
        boundary: {
          id: newBoundaryId,
          regionId: parseInt(regionId),
          version: newVersion,
          revertedFromVersion: currentBoundary.version,
          revertedToVersion: parseInt(version)
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Revert boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert boundary',
      details: error.message
    });
  }
};

module.exports = {
  getRegionBoundary,
  getRegionBoundaryHistory,
  updateRegionBoundary,
  getBoundaryChangeHistory,
  revertBoundaryToVersion
};
