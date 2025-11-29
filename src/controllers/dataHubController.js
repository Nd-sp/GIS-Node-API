const { pool } = require('../config/database');

/**
 * @route   GET /api/datahub/all
 * @desc    Get all user's data (measurements, drawings, etc.)
 * @access  Private
 */
const getAllData = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const currentUserRole = (req.user.role || '').toLowerCase();
    const { filter, userId: filterUserId } = req.query;
    const allData = [];

    console.log('📊 DataHub getAllData request:', {
      currentUserId,
      currentUserRole,
      filter,
      filterUserId
    });

    // Build WHERE condition based on role and filter
    let whereCondition = 'WHERE created_by = ?';
    let whereParams = [currentUserId];

    if (filter === 'all' && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
      whereCondition = '';
      whereParams = [];
      console.log('📊 Admin/Manager viewing ALL users data');
    } else if (filter === 'user' && (currentUserRole === 'admin' || currentUserRole === 'manager') && filterUserId) {
      const parsedUserId = parseInt(filterUserId);
      if (!isNaN(parsedUserId) && parsedUserId > 0) {
        whereCondition = 'WHERE created_by = ?';
        whereParams = [parsedUserId];
        console.log('📊 Admin/Manager viewing user', parsedUserId);
      } else {
        console.log('⚠️ Invalid userId filter, defaulting to current user');
        // Invalid userId, default to current user
        whereCondition = 'WHERE created_by = ?';
        whereParams = [currentUserId];
      }
    }

    // 🚀 PERFORMANCE: Execute all queries in parallel using Promise.all
    // Fix ambiguous column by adding table prefix
    let whereConditionCreatedBy = whereCondition;
    if (whereCondition === 'WHERE created_by = ?') {
      // Already has created_by, just need to prefix it
      whereConditionCreatedBy = whereCondition;
    } else if (whereCondition === '') {
      // No filter (admin viewing all)
      whereConditionCreatedBy = '';
    }

    const [
      distancesResult,
      polygonsResult,
      circlesResult,
      elevationsResult,
      infrastructuresResult,
      sectorsResult,
      fiberRingsResult
    ] = await Promise.all([
      pool.query(
        `SELECT d.*, u.username as username FROM distance_measurements d
         LEFT JOIN users u ON d.created_by = u.id
         ${whereConditionCreatedBy.replace('created_by', 'd.created_by')}
         ORDER BY d.created_at DESC`,
        whereParams
      ),
      pool.query(
        `SELECT p.*, u.username as username FROM polygon_drawings p
         LEFT JOIN users u ON p.created_by = u.id
         ${whereConditionCreatedBy.replace('created_by', 'p.created_by')}
         ORDER BY p.created_at DESC`,
        whereParams
      ),
      pool.query(
        `SELECT c.*, u.username as username FROM circle_drawings c
         LEFT JOIN users u ON c.created_by = u.id
         ${whereConditionCreatedBy.replace('created_by', 'c.created_by')}
         ORDER BY c.created_at DESC`,
        whereParams
      ),
      pool.query(
        `SELECT e.*, u.username as username FROM elevation_profiles e
         LEFT JOIN users u ON e.created_by = u.id
         ${whereConditionCreatedBy.replace('created_by', 'e.created_by')}
         ORDER BY e.created_at DESC`,
        whereParams
      ),
      pool.query(
        `SELECT i.*, u.username as username FROM infrastructure_items i
         LEFT JOIN users u ON i.created_by = u.id
         ${whereConditionCreatedBy.replace('created_by', 'i.created_by')}
         ORDER BY i.created_at DESC`,
        whereParams
      ),
      pool.query(
        `SELECT s.*, u.username as username FROM sector_rf_data s
         LEFT JOIN users u ON s.user_id = u.id
         ${whereConditionCreatedBy.replace('created_by', 's.user_id')}
         ORDER BY s.created_at DESC`,
        whereParams
      ),
      pool.query(
        `SELECT f.*, u.username as username FROM fiber_rings f
         LEFT JOIN users u ON f.created_by = u.id
         ${whereConditionCreatedBy.replace('created_by', 'f.created_by')}
         ORDER BY f.created_at DESC`,
        whereParams
      )
    ]);

    // Extract data from results
    const distancesRaw = distancesResult[0] || [];
    const polygons = polygonsResult[0] || [];
    const circles = circlesResult[0] || [];
    const elevations = elevationsResult[0] || [];
    const infrastructures = infrastructuresResult[0] || [];
    const sectors = sectorsResult[0] || [];
    const fiberRings = fiberRingsResult[0] || [];

    // Transform distance measurements to include points array
    const distances = distancesRaw.map(dist => ({
      ...dist,
      points: [
        { lat: parseFloat(dist.start_lat), lng: parseFloat(dist.start_lng) },
        { lat: parseFloat(dist.end_lat), lng: parseFloat(dist.end_lng) }
      ]
    }));

    console.log('📊 DataHub getAllData response:', {
      distances: distances.length,
      polygons: polygons.length,
      circles: circles.length,
      elevations: elevations.length,
      infrastructures: infrastructures.length,
      sectors: sectors.length,
      fiberRings: fiberRings.length
    });

    res.json({
      success: true,
      data: {
        distances,
        polygons,
        circles,
        elevations,
        infrastructures,
        sectors,
        fiberRings
      },
      totalCount: distances.length + polygons.length + circles.length +
                  elevations.length + infrastructures.length + sectors.length + fiberRings.length
    });
  } catch (error) {
    console.error('Get all data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get all data' });
  }
};

/**
 * @route   POST /api/datahub/import
 * @desc    Import data (placeholder for future implementation)
 * @access  Private
 */
const importData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { import_type, import_data } = req.body;

    if (!import_type || !import_data) {
      return res.status(400).json({
        success: false,
        error: 'Import type and data required'
      });
    }

    // Placeholder - implement actual import logic
    res.status(201).json({
      success: true,
      message: 'Import feature coming soon'
    });
  } catch (error) {
    console.error('Import data error:', error);
    res.status(500).json({ success: false, error: 'Failed to import data' });
  }
};

/**
 * @route   GET /api/datahub/imports
 * @desc    Get import history (placeholder for future implementation)
 * @access  Private
 */
const getImportHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    // Placeholder - return empty array for now
    res.json({ success: true, imports: [], count: 0 });
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get import history' });
  }
};

/**
 * @route   POST /api/datahub/export
 * @desc    Export data (user-wise)
 * @access  Private
 */
const exportData = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      export_type,
      export_scope,
      region_id,
      export_settings
    } = req.body;

    if (!export_type || !export_scope) {
      return res.status(400).json({
        success: false,
        error: 'Export type and scope required'
      });
    }

    const validTypes = ['geojson', 'kml', 'csv', 'excel', 'pdf', 'image'];
    const validScopes = ['current_view', 'selected_items', 'all_data', 'region'];

    if (!validTypes.includes(export_type)) {
      return res.status(400).json({ success: false, error: 'Invalid export type' });
    }
    if (!validScopes.includes(export_scope)) {
      return res.status(400).json({ success: false, error: 'Invalid export scope' });
    }

    const fileName = `export_${Date.now()}.${export_type}`;
    const fileUrl = `/exports/${userId}/${fileName}`;

    const [result] = await pool.query(
      `INSERT INTO data_hub_exports
       (user_id, region_id, export_type, export_scope, file_name, file_url,
        export_status, export_settings, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [
        userId,
        region_id,
        export_type,
        export_scope,
        fileName,
        fileUrl,
        export_settings ? JSON.stringify(export_settings) : null
      ]
    );

    // Placeholder - implement actual export logic
    setTimeout(async () => {
      await pool.query(
        `UPDATE data_hub_exports
         SET export_status = 'completed', records_exported = 0, completed_at = NOW()
         WHERE id = ?`,
        [result.insertId]
      );
    }, 1000);

    res.status(201).json({
      success: true,
      export_id: result.insertId,
      status: 'pending',
      message: 'Export started'
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
};

/**
 * @route   GET /api/datahub/exports
 * @desc    Get export history (user-wise)
 * @access  Private
 */
const getExportHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const [exports] = await pool.query(
      `SELECT * FROM data_hub_exports
       WHERE created_by = ?
       AND (expires_at IS NULL OR end_time > NOW())
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, exports, count: exports.length });
  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({ success: false, error: 'Failed to get export history' });
  }
};

/**
 * @route   GET /api/datahub/exports/:id/download
 * @desc    Download exported file
 * @access  Private
 */
const downloadExport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [exports] = await pool.query(
      `SELECT * FROM data_hub_exports
       WHERE id = ? AND user_id = ?
       AND export_status = 'completed'
       AND (expires_at IS NULL OR end_time > NOW())`,
      [id, userId]
    );

    if (exports.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Export not found or expired'
      });
    }

    const exportData = exports[0];

    // Placeholder - implement actual file download
    res.json({
      success: true,
      file_url: exportData.file_url,
      file_name: exportData.file_name,
      message: 'Use file_url to download'
    });
  } catch (error) {
    console.error('Download export error:', error);
    res.status(500).json({ success: false, error: 'Failed to download export' });
  }
};

/**
 * @route   DELETE /api/datahub/delete/:type/:id
 * @desc    Delete single data item (Admin can delete any, users can delete their own)
 * @access  Private
 */
const deleteSingleData = async (req, res) => {
  try {
    const { type, id } = req.params;
    const currentUserId = req.user.id;
    const currentUserRole = (req.user.role || '').toLowerCase();

    console.log('🗑️ Delete single data request:', {
      currentUserId,
      currentUserRole,
      type,
      id
    });

    // Map type to table name
    const tableMap = {
      'distance': 'distance_measurements',
      'polygon': 'polygon_drawings',
      'circle': 'circle_drawings',
      'sector': 'sector_rf_data',
      'fiberRing': 'fiber_rings',
      'elevation': 'elevation_profiles',
      'infrastructure': 'infrastructure_items',
      'customer': 'infrastructure_items' // Customers are also stored in infrastructure_items
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data type'
      });
    }

    // Map type to correct user ID column (most tables use created_by, sector uses user_id)
    const userIdColumn = type === 'sector' ? 'user_id' : 'created_by';

    // Check if item exists and get owner
    const [items] = await pool.query(
      `SELECT ${userIdColumn} as owner_id FROM ${tableName} WHERE id = ?`,
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }

    const itemUserId = items[0].owner_id;

    // Authorization check: Admin can delete any, users can only delete their own
    if (currentUserRole !== 'admin' && itemUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied. You can only delete your own data.'
      });
    }

    // Delete the item
    await pool.query(
      `DELETE FROM ${tableName} WHERE id = ?`,
      [id]
    );

    console.log('✅ Successfully deleted:', { type, id, tableName });

    res.json({
      success: true,
      message: 'Data deleted successfully'
    });
  } catch (error) {
    console.error('Delete single data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete data'
    });
  }
};

/**
 * @route   DELETE /api/datahub/delete-bulk/:type
 * @desc    Bulk delete data by category (Admin only or user's own data)
 * @access  Private
 */
const deleteBulkData = async (req, res) => {
  try {
    const { type } = req.params;
    const { userId } = req.body; // Optional: specific user's data to delete
    const currentUserId = req.user.id;
    const currentUserRole = (req.user.role || '').toLowerCase();

    console.log('🗑️ Bulk delete request:', {
      currentUserId,
      currentUserRole,
      type,
      targetUserId: userId
    });

    // Map type to table name
    const tableMap = {
      'distance': 'distance_measurements',
      'polygon': 'polygon_drawings',
      'circle': 'circle_drawings',
      'sector': 'sector_rf_data',
      'fiberRing': 'fiber_rings',
      'elevation': 'elevation_profiles',
      'infrastructure': 'infrastructure_items',
      'customer': 'infrastructure_items' // Customers are also stored in infrastructure_items
    };

    const tableName = tableMap[type];
    if (!tableName) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data type'
      });
    }

    // Map type to correct user ID column (most tables use created_by, sector uses user_id)
    const userIdColumn = type === 'sector' ? 'user_id' : 'created_by';

    let whereCondition = `WHERE ${userIdColumn} = ?`;
    let whereParams = [];

    if (userId && currentUserRole === 'admin') {
      // Admin deleting specific user's data
      whereParams = [userId];
    } else if (currentUserRole === 'admin' && !userId) {
      // Admin deleting all data in category
      whereCondition = '';
      whereParams = [];
    } else {
      // Regular user deleting their own data
      whereParams = [currentUserId];
    }

    // Get count before deletion
    const countQuery = `SELECT COUNT(*) as count FROM ${tableName} ${whereCondition}`;
    const [countResult] = await pool.query(countQuery, whereParams);
    const deletedCount = countResult[0].count;

    // Delete the items
    const deleteQuery = `DELETE FROM ${tableName} ${whereCondition}`;
    await pool.query(deleteQuery, whereParams);

    console.log('✅ Bulk delete successful:', {
      type,
      tableName,
      deletedCount
    });

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} ${type} record(s)`,
      deletedCount
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk delete data'
    });
  }
};

module.exports = {
  getAllData,
  importData,
  getImportHistory,
  exportData,
  getExportHistory,
  downloadExport,
  deleteSingleData,
  deleteBulkData
};
