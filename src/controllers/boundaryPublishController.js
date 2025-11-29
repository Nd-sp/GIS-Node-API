const { pool } = require('../config/database');
const { broadcastToAll } = require('../services/websocketService');

/**
 * @route   POST /api/regions/:id/boundary-version/draft/publish
 * @desc    Publish draft boundary and migrate all infrastructure items
 * @access  Private (Admin only)
 */
const publishDraftBoundary = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { publishReason, notifyUsers = true } = req.body;
    const userId = req.user.id;

    // Only admin can publish
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can publish boundary changes'
      });
    }

    // Get draft boundary
    const [drafts] = await pool.query(
      `SELECT * FROM boundary_versions
       WHERE region_id = ? AND status = 'draft'
       LIMIT 1`,
      [regionId]
    );

    if (drafts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No draft boundary exists for this region'
      });
    }

    const draft = drafts[0];
    const draftGeojson = JSON.stringify(draft.boundary_geojson);

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ============================================
      // STEP 1: Analyze impact
      // ============================================
      console.log('Publishing boundary - Step 1: Analyzing impact...');

      // NOTE: Using ST_SRID() to set SRID to 4326 for POINT to match GeoJSON geometry SRID
      const [impactResults] = await connection.query(
        `SELECT
          ii.id,
          ii.item_name,
          ii.item_type,
          ii.latitude,
          ii.longitude,
          ii.region_id as current_region_id,
          ST_Within(
            ST_SRID(POINT(ii.longitude, ii.latitude), 4326),
            ST_GeomFromGeoJSON(?)
          ) as will_be_inside
        FROM infrastructure_items ii
        WHERE ii.region_id = ? OR ST_Within(
          ST_SRID(POINT(ii.longitude, ii.latitude), 4326),
          ST_GeomFromGeoJSON(?)
        )`,
        [draftGeojson, regionId, draftGeojson]
      );

      const itemsToUpdate = [];
      const itemsBecomingInvalid = [];

      for (const item of impactResults) {
        const willBeInside = item.will_be_inside === 1;
        const currentlyInRegion = item.current_region_id === parseInt(regionId);

        if (currentlyInRegion && !willBeInside) {
          // Item is leaving this region - find new region
          // NOTE: Using ST_SRID() to set SRID to 4326 for POINT to match GeoJSON geometry SRID
          const [newRegions] = await connection.query(
            `SELECT r.id
             FROM boundary_versions bv
             JOIN regions r ON bv.region_id = r.id
             WHERE bv.status = 'published'
             AND bv.region_id != ?
             AND ST_Within(
               ST_SRID(POINT(?, ?), 4326),
               ST_GeomFromGeoJSON(bv.boundary_geojson)
             )
             LIMIT 1`,
            [regionId, item.longitude, item.latitude]
          );

          if (newRegions.length > 0) {
            itemsToUpdate.push({
              id: item.id,
              oldRegionId: item.current_region_id,
              newRegionId: newRegions[0].id,
              isInvalid: false
            });
          } else {
            itemsBecomingInvalid.push({
              id: item.id,
              oldRegionId: item.current_region_id,
              newRegionId: null,
              isInvalid: true
            });
          }
        } else if (!currentlyInRegion && willBeInside) {
          // Item is moving into this region
          itemsToUpdate.push({
            id: item.id,
            oldRegionId: item.current_region_id,
            newRegionId: parseInt(regionId),
            isInvalid: false
          });
        }
      }

      // ============================================
      // STEP 2: Archive current published version
      // ============================================
      console.log('Publishing boundary - Step 2: Archiving current version...');

      await connection.query(
        `UPDATE boundary_versions
         SET status = 'archived'
         WHERE region_id = ? AND status = 'published'`,
        [regionId]
      );

      // ============================================
      // STEP 3: Publish draft
      // ============================================
      console.log('Publishing boundary - Step 3: Publishing draft...');

      const impactSummary = {
        totalAffected: impactResults.length,
        itemsUpdated: itemsToUpdate.length,
        itemsBecomingInvalid: itemsBecomingInvalid.length,
        publishedAt: new Date().toISOString(),
        publishedBy: userId
      };

      await connection.query(
        `UPDATE boundary_versions
         SET status = 'published',
             published_by = ?,
             published_at = NOW(),
             change_reason = ?,
             impact_summary = ?
         WHERE id = ?`,
        [userId, publishReason || 'Boundary update', JSON.stringify(impactSummary), draft.id]
      );

      // ============================================
      // STEP 4: Update infrastructure items
      // ============================================
      console.log(`Publishing boundary - Step 4: Updating ${itemsToUpdate.length} infrastructure items...`);

      const rollbackExpiresAt = new Date();
      rollbackExpiresAt.setDate(rollbackExpiresAt.getDate() + 30); // 30 days

      for (const item of itemsToUpdate) {
        // Update infrastructure item region
        await connection.query(
          'UPDATE infrastructure_items SET region_id = ? WHERE id = ?',
          [item.newRegionId, item.id]
        );

        // Record in history
        await connection.query(
          `INSERT INTO infrastructure_region_history
           (infrastructure_id, old_region_id, new_region_id, boundary_version_id,
            version_number, changed_by, change_reason, is_invalid, can_rollback, rollback_expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
          [
            item.id,
            item.oldRegionId,
            item.newRegionId,
            draft.id,
            draft.version_number,
            userId,
            publishReason || 'Boundary update',
            item.isInvalid,
            rollbackExpiresAt
          ]
        );
      }

      // Handle invalid items
      for (const item of itemsBecomingInvalid) {
        // Set region to NULL for invalid items
        await connection.query(
          'UPDATE infrastructure_items SET region_id = NULL WHERE id = ?',
          [item.id]
        );

        // Record in history
        await connection.query(
          `INSERT INTO infrastructure_region_history
           (infrastructure_id, old_region_id, new_region_id, boundary_version_id,
            version_number, changed_by, change_reason, is_invalid, can_rollback, rollback_expires_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, TRUE, TRUE, ?)`,
          [
            item.id,
            item.oldRegionId,
            draft.id,
            draft.version_number,
            userId,
            publishReason || 'Boundary update',
            rollbackExpiresAt
          ]
        );
      }

      // ============================================
      // STEP 5: Update region_boundaries (backward compatibility)
      // ============================================
      console.log('Publishing boundary - Step 5: Updating legacy table...');

      // Deactivate old boundary
      await connection.query(
        'UPDATE region_boundaries SET is_active = FALSE WHERE region_id = ? AND is_active = TRUE',
        [regionId]
      );

      // Insert new boundary (backward compatibility - only use columns that exist)
      // NOTE: boundary_geojson must be a JSON string for MySQL
      const boundaryGeojsonString = typeof draft.boundary_geojson === 'string'
        ? draft.boundary_geojson
        : JSON.stringify(draft.boundary_geojson);

      await connection.query(
        `INSERT INTO region_boundaries
         (region_id, boundary_geojson, boundary_type, version, vertex_count, area_sqkm,
          created_by, source, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          regionId,
          boundaryGeojsonString,
          draft.boundary_type,
          draft.version_number,
          draft.vertex_count,
          draft.area_sqkm,
          userId,
          draft.source,
          draft.notes
        ]
      );

      // ============================================
      // STEP 6: Insert audit log
      // ============================================
      console.log('Publishing boundary - Step 6: Creating audit log...');

      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'PUBLISH_BOUNDARY',
          'region_boundary',
          regionId,
          JSON.stringify({
            versionId: draft.id,
            versionNumber: draft.version_number,
            itemsUpdated: itemsToUpdate.length,
            itemsBecomingInvalid: itemsBecomingInvalid.length,
            publishReason: publishReason || 'Boundary update'
          }),
          req.ip
        ]
      );

      // ============================================
      // STEP 7: Notify users (if enabled)
      // ============================================
      if (notifyUsers) {
        console.log('Publishing boundary - Step 7: Notifying affected users...');

        const [affectedUsers] = await connection.query(
          `SELECT DISTINCT u.id
           FROM users u
           JOIN user_regions ur ON u.id = ur.user_id
           WHERE ur.region_id = ? AND u.is_active = TRUE`,
          [regionId]
        );

        const [regionInfo] = await connection.query(
          'SELECT name FROM regions WHERE id = ?',
          [regionId]
        );

        for (const user of affectedUsers) {
          const itemsAffected = itemsToUpdate.length + itemsBecomingInvalid.length;
          await connection.query(
            `INSERT INTO notifications (user_id, type, title, message)
             VALUES (?, 'system_alert', ?, ?)`,
            [
              user.id,
              'Boundary Updated',
              `The boundary for ${regionInfo[0].name} has been updated (Version ${draft.version_number}). ${itemsAffected} infrastructure item(s) may have moved regions.`
            ]
          );
        }
      }

      // Commit transaction
      await connection.commit();

      console.log('Publishing boundary - COMPLETED SUCCESSFULLY!');

      // ============================================
      // STEP 8: Broadcast to all users via WebSocket
      // ============================================
      try {
        const [regionInfo] = await pool.query(
          'SELECT name FROM regions WHERE id = ?',
          [regionId]
        );

        broadcastToAll({
          event: 'boundary_published',
          data: {
            regionId: parseInt(regionId),
            regionName: regionInfo[0]?.name || 'Unknown',
            versionNumber: draft.version_number,
            publishedAt: new Date().toISOString(),
            itemsAffected: itemsToUpdate.length + itemsBecomingInvalid.length
          }
        });

        console.log(`📡 WebSocket broadcast sent: boundary_published for ${regionInfo[0]?.name}`);
      } catch (wsError) {
        // Don't fail the request if WebSocket fails
        console.error('⚠️  WebSocket broadcast failed:', wsError);
      }

      res.json({
        success: true,
        message: 'Boundary published successfully',
        published: {
          versionId: draft.id,
          versionNumber: draft.version_number,
          regionId: parseInt(regionId),
          publishedAt: new Date().toISOString(),
          impact: {
            totalAffected: impactResults.length,
            itemsUpdated: itemsToUpdate.length,
            itemsBecomingInvalid: itemsBecomingInvalid.length
          },
          rollbackExpiresAt: rollbackExpiresAt.toISOString()
        }
      });

    } catch (error) {
      await connection.rollback();
      console.error('Publishing boundary - ROLLBACK due to error:', error);
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Publish draft boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to publish boundary',
      details: error.message
    });
  }
};


/**
 * @route   POST /api/regions/:id/boundary-version/:versionId/rollback
 * @desc    Rollback to a previous boundary version (within 30 days)
 * @access  Private (Admin only)
 */
const rollbackBoundaryVersion = async (req, res) => {
  try {
    const { id: regionId, versionId } = req.params;
    const { rollbackReason } = req.body;
    const userId = req.user.id;

    // Only admin can rollback
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can rollback boundary changes'
      });
    }

    // Get the target version
    const [targetVersions] = await pool.query(
      `SELECT * FROM boundary_versions
       WHERE id = ? AND region_id = ? AND status = 'archived'`,
      [versionId, regionId]
    );

    if (targetVersions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Target version not found or cannot be rolled back'
      });
    }

    const targetVersion = targetVersions[0];

    // Check if rollback is still allowed (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (new Date(targetVersion.published_at) < thirtyDaysAgo) {
      return res.status(400).json({
        success: false,
        error: 'Cannot rollback to versions older than 30 days'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Archive current version
      await connection.query(
        `UPDATE boundary_versions
         SET status = 'archived'
         WHERE region_id = ? AND status = 'published'`,
        [regionId]
      );

      // Create new version from target (rollback creates a new version)
      const [currentMaxVersion] = await connection.query(
        'SELECT MAX(version_number) as max_version FROM boundary_versions WHERE region_id = ?',
        [regionId]
      );

      const newVersionNumber = (currentMaxVersion[0].max_version || 0) + 1;

      const [result] = await connection.query(
        `INSERT INTO boundary_versions
         (region_id, boundary_geojson, boundary_type, vertex_count, area_sqkm,
          version_number, status, created_by, published_by, published_at, source, notes, change_reason)
         VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, NOW(), ?, ?, ?)`,
        [
          regionId,
          targetVersion.boundary_geojson,
          targetVersion.boundary_type,
          targetVersion.vertex_count,
          targetVersion.area_sqkm,
          newVersionNumber,
          userId,
          userId,
          `Rolled back from version ${targetVersion.version_number}`,
          `Rollback: ${rollbackReason || 'Manual rollback'}`,
          rollbackReason || 'Manual rollback'
        ]
      );

      const newVersionId = result.insertId;

      // Rollback infrastructure items (find items that were changed by the rolled-back version)
      const [itemsToRollback] = await connection.query(
        `SELECT *
         FROM infrastructure_region_history
         WHERE boundary_version_id IN (
           SELECT id FROM boundary_versions
           WHERE region_id = ? AND version_number > ? AND status IN ('published', 'archived')
         )
         AND can_rollback = TRUE
         AND rollback_end_time > NOW()`,
        [regionId, targetVersion.version_number]
      );

      for (const historyItem of itemsToRollback) {
        // Restore old region
        await connection.query(
          'UPDATE infrastructure_items SET region_id = ? WHERE id = ?',
          [historyItem.old_region_id, historyItem.infrastructure_id]
        );

        // Record rollback in history
        await connection.query(
          `INSERT INTO infrastructure_region_history
           (infrastructure_id, old_region_id, new_region_id, boundary_version_id,
            version_number, changed_by, change_reason, is_invalid, can_rollback, rollback_expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, NULL)`,
          [
            historyItem.infrastructure_id,
            historyItem.new_region_id,
            historyItem.old_region_id,
            newVersionId,
            newVersionNumber,
            userId,
            `Rollback: ${rollbackReason || 'Manual rollback'}`
          ]
        );
      }

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'ROLLBACK_BOUNDARY',
          'region_boundary',
          regionId,
          JSON.stringify({
            targetVersionId: versionId,
            targetVersionNumber: targetVersion.version_number,
            newVersionId,
            newVersionNumber,
            itemsRolledBack: itemsToRollback.length,
            rollbackReason: rollbackReason || 'Manual rollback'
          }),
          req.ip
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: 'Boundary rolled back successfully',
        rollback: {
          newVersionId,
          newVersionNumber,
          targetVersionNumber: targetVersion.version_number,
          itemsRolledBack: itemsToRollback.length
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Rollback boundary version error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback boundary',
      details: error.message
    });
  }
};


/**
 * @route   POST /api/regions/:id/boundary-version/unpublish
 * @desc    Unpublish (archive) the current published boundary
 * @access  Private (Admin only)
 */
const unpublishBoundary = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { unpublishReason } = req.body;
    const userId = req.user.id;

    // Only admin can unpublish
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can unpublish boundary changes'
      });
    }

    // Get published boundary
    const [published] = await pool.query(
      `SELECT * FROM boundary_versions
       WHERE region_id = ? AND status = 'published'
       LIMIT 1`,
      [regionId]
    );

    if (published.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No published boundary exists for this region'
      });
    }

    const publishedVersion = published[0];

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      console.log('Unpublishing boundary - Starting...');

      // Archive the published version
      await connection.query(
        `UPDATE boundary_versions
         SET status = 'archived'
         WHERE region_id = ? AND status = 'published'`,
        [regionId]
      );

      console.log('Unpublishing boundary - Version archived');

      // Insert audit log
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          'UNPUBLISH_BOUNDARY',
          'region_boundary',
          regionId,
          JSON.stringify({
            versionId: publishedVersion.id,
            versionNumber: publishedVersion.version_number,
            unpublishReason: unpublishReason || 'Manual unpublish',
            timestamp: new Date().toISOString()
          }),
          req.ip
        ]
      );

      console.log('Unpublishing boundary - Audit log created');

      await connection.commit();

      console.log('Unpublishing boundary - COMPLETED SUCCESSFULLY!');

      res.json({
        success: true,
        message: 'Boundary unpublished (archived) successfully',
        unpublished: {
          versionId: publishedVersion.id,
          versionNumber: publishedVersion.version_number,
          archivedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Unpublish boundary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unpublish boundary',
      details: error.message
    });
  }
};


module.exports = {
  publishDraftBoundary,
  rollbackBoundaryVersion,
  unpublishBoundary
};
