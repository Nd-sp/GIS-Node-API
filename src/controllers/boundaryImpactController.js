const { pool } = require('../config/database');

/**
 * @route   POST /api/regions/:id/boundary-version/draft/analyze-impact
 * @desc    Analyze impact of publishing draft boundary
 * @access  Private (Admin/Manager)
 */
const analyzeImpact = async (req, res) => {
  try {
    const { id: regionId } = req.params;

    // Get draft boundary
    const [drafts] = await pool.query(
      `SELECT id, boundary_geojson, boundary_type
       FROM boundary_versions
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

    // Analyze impact on infrastructure items
    // NOTE: Using ST_SRID() to set SRID to 4326 for POINT to match GeoJSON geometry SRID
    const [impactResults] = await pool.query(
      `SELECT
        ii.id,
        ii.item_name,
        ii.item_type,
        ii.latitude,
        ii.longitude,
        ii.region_id as current_region_id,
        r.name as current_region_name,

        -- Check if item will be inside new boundary
        ST_Within(
          ST_SRID(POINT(ii.longitude, ii.latitude), 4326),
          ST_GeomFromGeoJSON(?)
        ) as will_be_inside,

        -- Check if item is currently in this region
        (ii.region_id = ?) as currently_in_region

      FROM infrastructure_items ii
      LEFT JOIN regions r ON ii.region_id = r.id
      WHERE ii.region_id = ? OR ST_Within(
        ST_SRID(POINT(ii.longitude, ii.latitude), 4326),
        ST_GeomFromGeoJSON(?)
      )`,
      [draftGeojson, regionId, regionId, draftGeojson]
    );

    // Process results
    const itemsMovingOut = [];
    const itemsMovingIn = [];
    const itemsStaying = [];
    const itemsBecomingInvalid = [];

    for (const item of impactResults) {
      const willBeInside = item.will_be_inside === 1;
      const currentlyInRegion = item.currently_in_region === 1;

      if (currentlyInRegion && !willBeInside) {
        // Item is leaving this region
        itemsMovingOut.push({
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          latitude: item.latitude,
          longitude: item.longitude,
          currentRegionId: item.current_region_id,
          currentRegionName: item.current_region_name
        });
      } else if (!currentlyInRegion && willBeInside) {
        // Item is moving into this region
        itemsMovingIn.push({
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          latitude: item.latitude,
          longitude: item.longitude,
          currentRegionId: item.current_region_id,
          currentRegionName: item.current_region_name
        });
      } else if (currentlyInRegion && willBeInside) {
        // Item is staying in this region
        itemsStaying.push({
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          latitude: item.latitude,
          longitude: item.longitude
        });
      }
    }

    // For items moving out, check if they will be in another region or become invalid
    for (const item of itemsMovingOut) {
      // Check if item will be in any other published boundary
      // NOTE: Using ST_SRID() to set SRID to 4326 for POINT to match GeoJSON geometry SRID
      const [otherRegions] = await pool.query(
        `SELECT r.id, r.name
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

      if (otherRegions.length > 0) {
        item.newRegionId = otherRegions[0].id;
        item.newRegionName = otherRegions[0].name;
      } else {
        // Item will become invalid (not in any region)
        itemsBecomingInvalid.push(item);
      }
    }

    // Get affected users (users who have access to this region)
    const [affectedUsers] = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.email, u.role
       FROM users u
       JOIN user_regions ur ON u.id = ur.user_id
       WHERE ur.region_id = ? AND u.is_active = TRUE`,
      [regionId]
    );

    // Summary statistics
    const summary = {
      totalAffected: impactResults.length,
      itemsStaying: itemsStaying.length,
      itemsMovingOut: itemsMovingOut.length,
      itemsMovingIn: itemsMovingIn.length,
      itemsBecomingInvalid: itemsBecomingInvalid.length,
      affectedUsersCount: affectedUsers.length
    };

    res.json({
      success: true,
      impact: {
        summary,
        itemsStaying: itemsStaying.slice(0, 100), // Limit to 100 for performance
        itemsMovingOut,
        itemsMovingIn,
        itemsBecomingInvalid,
        affectedUsers,
        hasStaying: itemsStaying.length > 100,
        totalStaying: itemsStaying.length
      }
    });

  } catch (error) {
    console.error('Analyze boundary impact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze boundary impact',
      details: error.message
    });
  }
};


/**
 * @route   GET /api/regions/:id/infrastructure-history
 * @desc    Get infrastructure region change history for a region
 * @access  Private (Admin/Manager)
 */
const getInfrastructureHistory = async (req, res) => {
  try {
    const { id: regionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [history] = await pool.query(
      `SELECT
        irh.id,
        irh.infrastructure_id,
        irh.old_region_id,
        irh.new_region_id,
        irh.boundary_version_id,
        irh.version_number,
        irh.changed_by,
        irh.changed_at,
        irh.change_reason,
        irh.is_invalid,
        irh.can_rollback,
        irh.rollback_expires_at,
        ii.item_name,
        ii.item_type,
        old_r.name as old_region_name,
        new_r.name as new_region_name,
        u.full_name as changed_by_name
      FROM infrastructure_region_history irh
      LEFT JOIN infrastructure_items ii ON irh.infrastructure_id = ii.id
      LEFT JOIN regions old_r ON irh.old_region_id = old_r.id
      LEFT JOIN regions new_r ON irh.new_region_id = new_r.id
      LEFT JOIN users u ON irh.changed_by = u.id
      WHERE irh.old_region_id = ? OR irh.new_region_id = ?
      ORDER BY irh.changed_at DESC
      LIMIT ? OFFSET ?`,
      [regionId, regionId, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM infrastructure_region_history
       WHERE old_region_id = ? OR new_region_id = ?`,
      [regionId, regionId]
    );

    res.json({
      success: true,
      history: history.map(h => ({
        id: h.id,
        infrastructureId: h.infrastructure_id,
        infrastructureName: h.item_name,
        infrastructureType: h.item_type,
        oldRegionId: h.old_region_id,
        oldRegionName: h.old_region_name,
        newRegionId: h.new_region_id,
        newRegionName: h.new_region_name,
        boundaryVersionId: h.boundary_version_id,
        versionNumber: h.version_number,
        changedBy: h.changed_by,
        changedByName: h.changed_by_name,
        changedAt: h.changed_at,
        changeReason: h.change_reason,
        isInvalid: h.is_invalid,
        canRollback: h.can_rollback,
        rollbackExpiresAt: h.rollback_expires_at
      })),
      total: countResult[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Get infrastructure history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get infrastructure history'
    });
  }
};


module.exports = {
  analyzeImpact,
  getInfrastructureHistory
};
