const { pool } = require('../config/database');

/**
 * @route   GET /api/regions/:id/boundary-versions
 * @desc    Get all boundary versions (draft + published) for a region
 * @access  Private (Admin/Manager)
 */
const getRegionBoundaryVersions = async (req, res) => {
  try {
    const { id: regionId } = req.params;

    const [versions] = await pool.query(
      `SELECT
        bv.id,
        bv.region_id,
        bv.boundary_type,
        bv.vertex_count,
        bv.area_sqkm,
        bv.version_number,
        bv.status,
        bv.created_by,
        bv.created_at,
        bv.published_by,
        bv.published_at,
        bv.notes,
        bv.change_reason,
        bv.source,
        bv.impact_summary,
        creator.full_name as created_by_name,
        publisher.full_name as published_by_name
      FROM boundary_versions bv
      LEFT JOIN users creator ON bv.created_by = creator.id
      LEFT JOIN users publisher ON bv.published_by = publisher.id
      WHERE bv.region_id = ?
      ORDER BY bv.version_number DESC`,
      [regionId]
    );

    res.json({
      success: true,
      versions: versions.map(v => ({
        id: v.id,
        regionId: v.region_id,
        type: v.boundary_type,
        vertexCount: v.vertex_count,
        areaSqKm: v.area_sqkm,
        versionNumber: v.version_number,
        status: v.status,
        createdBy: v.created_by,
        createdByName: v.created_by_name,
        createdAt: v.created_at,
        publishedBy: v.published_by,
        publishedByName: v.published_by_name,
        publishedAt: v.published_at,
        notes: v.notes,
        changeReason: v.change_reason,
        source: v.source,
        impactSummary: v.impact_summary ? (typeof v.impact_summary === 'string' ? JSON.parse(v.impact_summary) : v.impact_summary) : null
      })),
      total: versions.length
    });

  } catch (error) {
    console.error('Get region boundary versions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get boundary versions'
    });
  }
};


/**
 * @route   GET /api/regions/:id/boundary-version/draft
 * @desc    Get draft boundary version for a region (if exists)
 * @access  Private (Admin/Manager)
 */
const getDraftBoundary = async (req, res) => {
  try {
    const { id: regionId } = req.params;

    const [drafts] = await pool.query(
      `SELECT
        bv.id,
        bv.region_id,
        bv.boundary_geojson,
        bv.boundary_type,
        bv.vertex_count,
        bv.area_sqkm,
        bv.version_number,
        bv.status,
        bv.created_by,
        bv.created_at,
        bv.notes,
        bv.change_reason,
        bv.source,
        u.full_name as created_by_name
      FROM boundary_versions bv
      LEFT JOIN users u ON bv.created_by = u.id
      WHERE bv.region_id = ? AND bv.status = 'draft'
      LIMIT 1`,
      [regionId]
    );

    if (drafts.length === 0) {
      return res.json({
        success: true,
        draft: null,
        message: 'No draft boundary exists for this region'
      });
    }

    const draft = drafts[0];

    res.json({
      success: true,
      draft: {
        id: draft.id,
        regionId: draft.region_id,
        geojson: draft.boundary_geojson,
        type: draft.boundary_type,
        vertexCount: draft.vertex_count,
        areaSqKm: draft.area_sqkm,
        versionNumber: draft.version_number,
        status: draft.status,
        createdBy: draft.created_by,
        createdByName: draft.created_by_name,
        createdAt: draft.created_at,
        notes: draft.notes,
        changeReason: draft.change_reason,
        source: draft.source
      }
    });

  } catch (error) {
    console.error('Get draft boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get draft boundary'
    });
  }
};


/**
 * @route   POST /api/regions/:id/boundary-version/draft
 * @desc    Create or update draft boundary for a region
 * @access  Private (Admin/Manager)
 */
const createOrUpdateDraft = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { boundaryGeoJSON, changeReason, notes, source } = req.body;
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

    // Check if draft already exists
    const [existingDrafts] = await pool.query(
      'SELECT id, version_number FROM boundary_versions WHERE region_id = ? AND status = ?',
      [regionId, 'draft']
    );

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      let draftId;
      let versionNumber;

      if (existingDrafts.length > 0) {
        // Update existing draft
        draftId = existingDrafts[0].id;
        versionNumber = existingDrafts[0].version_number;

        await connection.query(
          `UPDATE boundary_versions
           SET boundary_geojson = ?,
               boundary_type = ?,
               vertex_count = ?,
               notes = ?,
               change_reason = ?,
               source = ?
           WHERE id = ?`,
          [
            JSON.stringify(boundaryGeoJSON),
            boundaryGeoJSON.type,
            vertexCount,
            notes || null,
            changeReason || 'Boundary update',
            source || 'Manual Edit',
            draftId
          ]
        );

      } else {
        // Create new draft
        // Get the next version number
        const [maxVersion] = await connection.query(
          'SELECT MAX(version_number) as max_version FROM boundary_versions WHERE region_id = ?',
          [regionId]
        );

        versionNumber = (maxVersion[0].max_version || 0) + 1;

        const [result] = await connection.query(
          `INSERT INTO boundary_versions
           (region_id, boundary_geojson, boundary_type, vertex_count, version_number, status, created_by, notes, change_reason, source)
           VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
          [
            regionId,
            JSON.stringify(boundaryGeoJSON),
            boundaryGeoJSON.type,
            vertexCount,
            versionNumber,
            userId,
            notes || null,
            changeReason || 'Boundary update',
            source || 'Manual Edit'
          ]
        );

        draftId = result.insertId;
      }

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          existingDrafts.length > 0 ? 'UPDATE_DRAFT_BOUNDARY' : 'CREATE_DRAFT_BOUNDARY',
          'region_boundary',
          regionId,
          JSON.stringify({
            draftId,
            versionNumber,
            vertexCount,
            changeReason: changeReason || 'Boundary update'
          }),
          req.ip
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: existingDrafts.length > 0 ? 'Draft boundary updated successfully' : 'Draft boundary created successfully',
        draft: {
          id: draftId,
          regionId: parseInt(regionId),
          versionNumber: versionNumber,
          vertexCount: vertexCount,
          type: boundaryGeoJSON.type,
          status: 'draft'
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Create/update draft boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save draft boundary',
      details: error.message
    });
  }
};


/**
 * @route   DELETE /api/regions/:id/boundary-version/draft
 * @desc    Discard draft boundary for a region
 * @access  Private (Admin/Manager)
 */
const discardDraft = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const userId = req.user.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check if draft exists
      const [drafts] = await connection.query(
        'SELECT id, version_number FROM boundary_versions WHERE region_id = ? AND status = ?',
        [regionId, 'draft']
      );

      if (drafts.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'No draft boundary exists for this region'
        });
      }

      const draftId = drafts[0].id;

      // Delete the draft
      await connection.query(
        'DELETE FROM boundary_versions WHERE id = ?',
        [draftId]
      );

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'DISCARD_DRAFT_BOUNDARY',
          'region_boundary',
          regionId,
          JSON.stringify({ draftId, versionNumber: drafts[0].version_number }),
          req.ip
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: 'Draft boundary discarded successfully'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Discard draft boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to discard draft boundary',
      details: error.message
    });
  }
};


/**
 * @route   POST /api/regions/:id/boundary-version/:versionId/edit
 * @desc    Create a new draft from an existing published version for editing
 * @access  Private (Admin/Manager)
 */
const createDraftFromVersion = async (req, res) => {
  try {
    const { id: regionId, versionId } = req.params;
    const userId = req.user.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check if draft already exists
      const [existingDrafts] = await connection.query(
        'SELECT id FROM boundary_versions WHERE region_id = ? AND status = ?',
        [regionId, 'draft']
      );

      if (existingDrafts.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          error: 'A draft already exists for this region. Please discard it first or continue editing.'
        });
      }

      // Get the source version
      const [sourceVersions] = await connection.query(
        'SELECT * FROM boundary_versions WHERE id = ? AND region_id = ?',
        [versionId, regionId]
      );

      if (sourceVersions.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: 'Source version not found'
        });
      }

      const sourceVersion = sourceVersions[0];

      // Get the next version number
      const [maxVersion] = await connection.query(
        'SELECT MAX(version_number) as max_version FROM boundary_versions WHERE region_id = ?',
        [regionId]
      );

      const newVersionNumber = (maxVersion[0].max_version || 0) + 1;

      // Ensure boundary_geojson is properly stringified
      const boundaryGeoJson = typeof sourceVersion.boundary_geojson === 'string'
        ? sourceVersion.boundary_geojson
        : JSON.stringify(sourceVersion.boundary_geojson);

      // Create new draft from source version
      const [result] = await connection.query(
        `INSERT INTO boundary_versions
         (region_id, boundary_geojson, boundary_type, vertex_count, version_number, status, created_by, notes, change_reason, source)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        [
          regionId,
          boundaryGeoJson,
          sourceVersion.boundary_type,
          sourceVersion.vertex_count,
          newVersionNumber,
          userId,
          `Editing from Version ${sourceVersion.version_number}`,
          `Create draft from published version ${sourceVersion.version_number}`,
          'Version Copy'
        ]
      );

      const draftId = result.insertId;

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'CREATE_DRAFT_FROM_VERSION',
          'region_boundary',
          regionId,
          JSON.stringify({
            draftId,
            sourceVersionId: versionId,
            sourceVersionNumber: sourceVersion.version_number,
            newVersionNumber
          }),
          req.ip
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: `Draft created from Version ${sourceVersion.version_number}`,
        draft: {
          id: draftId,
          versionNumber: newVersionNumber,
          sourceVersion: sourceVersion.version_number
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Create draft from version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create draft from version',
      details: error.message
    });
  }
};

/**
 * @route   DELETE /api/regions/:id/boundary-version/:versionId
 * @desc    Delete a specific boundary version (draft or published)
 * @access  Private (Admin only)
 */
const deleteBoundaryVersion = async (req, res) => {
  try {
    const { id: regionId, versionId } = req.params;
    const { deleteReason } = req.body;
    const userId = req.user.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Get version details before deletion
      const [versions] = await connection.query(
        'SELECT * FROM boundary_versions WHERE id = ? AND region_id = ?',
        [versionId, regionId]
      );

      if (versions.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: 'Boundary version not found'
        });
      }

      const version = versions[0];

      // Prevent deletion of the only published version
      if (version.status === 'published') {
        const [publishedVersions] = await connection.query(
          'SELECT COUNT(*) as count FROM boundary_versions WHERE region_id = ? AND status = ?',
          [regionId, 'published']
        );

        if (publishedVersions[0].count <= 1) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({
            success: false,
            error: 'Cannot delete the only published version. Please publish a new version first.'
          });
        }
      }

      // Delete the version
      await connection.query(
        'DELETE FROM boundary_versions WHERE id = ?',
        [versionId]
      );

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'DELETE_BOUNDARY_VERSION',
          'region_boundary',
          regionId,
          JSON.stringify({
            versionId,
            versionNumber: version.version_number,
            status: version.status,
            deleteReason: deleteReason || 'No reason provided'
          }),
          req.ip
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: `${version.status === 'draft' ? 'Draft' : 'Published'} version ${version.version_number} deleted successfully`
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Delete boundary version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete boundary version',
      details: error.message
    });
  }
};

/**
 * @route   DELETE /api/regions/:id/boundary-data
 * @desc    Delete ALL boundary data for a region (all versions, history, etc.)
 * @access  Private (Admin only)
 */
const deleteAllBoundaryData = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { deleteReason } = req.body;
    const userId = req.user.id;

    // Only admin can delete all boundary data
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete all boundary data'
      });
    }

    if (!deleteReason || !deleteReason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Delete reason is required'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      console.log(`🗑️ Deleting ALL boundary data for region ${regionId}...`);

      // Get counts before deletion for reporting
      const [versionCount] = await connection.query(
        'SELECT COUNT(*) as count FROM boundary_versions WHERE region_id = ?',
        [regionId]
      );

      const [historyCount] = await connection.query(
        'SELECT COUNT(*) as count FROM infrastructure_region_history WHERE old_region_id = ? OR new_region_id = ?',
        [regionId, regionId]
      );

      // Step 1: Delete from infrastructure_region_history
      await connection.query(
        'DELETE FROM infrastructure_region_history WHERE old_region_id = ? OR new_region_id = ?',
        [regionId, regionId]
      );
      console.log(`✅ Deleted ${historyCount[0].count} infrastructure history records`);

      // Step 2: Delete from boundary_versions
      await connection.query(
        'DELETE FROM boundary_versions WHERE region_id = ?',
        [regionId]
      );
      console.log(`✅ Deleted ${versionCount[0].count} boundary versions`);

      // Step 3: Delete from region_boundaries (legacy table if exists)
      await connection.query(
        'DELETE FROM region_boundaries WHERE region_id = ?',
        [regionId]
      );
      console.log(`✅ Deleted legacy boundary data`);

      // Step 4: Create audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'DELETE_ALL_BOUNDARY_DATA',
          'region_boundaries',
          regionId,
          JSON.stringify({
            deletedVersions: versionCount[0].count,
            deletedHistoryRecords: historyCount[0].count,
            deleteReason: deleteReason,
            timestamp: new Date().toISOString()
          }),
          req.ip
        ]
      );

      await connection.commit();

      console.log(`✅ ALL boundary data deleted successfully for region ${regionId}`);

      res.json({
        success: true,
        message: 'All boundary data deleted successfully',
        deleted: {
          versions: versionCount[0].count,
          historyRecords: historyCount[0].count,
          regionId: regionId
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Delete all boundary data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete boundary data',
      details: error.message
    });
  }
};

module.exports = {
  getRegionBoundaryVersions,
  getDraftBoundary,
  createOrUpdateDraft,
  discardDraft,
  createDraftFromVersion,
  deleteBoundaryVersion,
  deleteAllBoundaryData
};
