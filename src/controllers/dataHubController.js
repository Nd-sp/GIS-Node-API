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
    let whereCondition = 'WHERE user_id = ?';
    let whereParams = [currentUserId];

    if (filter === 'all' && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
      whereCondition = '';
      whereParams = [];
      console.log('📊 Admin/Manager viewing ALL users data');
    } else if (filter === 'user' && (currentUserRole === 'admin' || currentUserRole === 'manager') && filterUserId) {
      const parsedUserId = parseInt(filterUserId);
      if (!isNaN(parsedUserId) && parsedUserId > 0) {
        whereCondition = 'WHERE user_id = ?';
        whereParams = [parsedUserId];
        console.log('📊 Admin/Manager viewing user', parsedUserId);
      } else {
        console.log('⚠️ Invalid userId filter, defaulting to current user');
        // Invalid userId, default to current user
        whereCondition = 'WHERE user_id = ?';
        whereParams = [currentUserId];
      }
    }

    // Fetch all measurement types with username
    const [distances] = await pool.query(
      `SELECT d.*, u.username as username FROM distance_measurements d
       LEFT JOIN users u ON d.user_id = u.id
       ${whereCondition} ORDER BY d.created_at DESC`,
      whereParams
    );
    distances.forEach(d => allData.push({ ...d, type: 'Distance' }));

    const [polygons] = await pool.query(
      `SELECT p.*, u.username as username FROM polygon_drawings p
       LEFT JOIN users u ON p.user_id = u.id
       ${whereCondition} ORDER BY p.created_at DESC`,
      whereParams
    );
    polygons.forEach(p => allData.push({ ...p, type: 'Polygon' }));

    const [circles] = await pool.query(
      `SELECT c.*, u.username as username FROM circle_drawings c
       LEFT JOIN users u ON c.user_id = u.id
       ${whereCondition} ORDER BY c.created_at DESC`,
      whereParams
    );
    circles.forEach(c => allData.push({ ...c, type: 'Circle' }));

    const [elevations] = await pool.query(
      `SELECT e.*, u.username as username FROM elevation_profiles e
       LEFT JOIN users u ON e.user_id = u.id
       ${whereCondition} ORDER BY e.created_at DESC`,
      whereParams
    );
    elevations.forEach(e => allData.push({ ...e, type: 'Elevation' }));

    const [infrastructures] = await pool.query(
      `SELECT i.*, u.username as username FROM infrastructure_items i
       LEFT JOIN users u ON i.user_id = u.id
       ${whereCondition} ORDER BY i.created_at DESC`,
      whereParams
    );
    infrastructures.forEach(i => allData.push({ ...i, type: 'Infrastructure' }));

    const [sectors] = await pool.query(
      `SELECT s.*, u.username as username FROM sector_rf_data s
       LEFT JOIN users u ON s.user_id = u.id
       ${whereCondition} ORDER BY s.created_at DESC`,
      whereParams
    );
    sectors.forEach(s => allData.push({ ...s, type: 'SectorRF' }));

    console.log('📊 DataHub response:', {
      totalItems: allData.length,
      distances: distances.length,
      polygons: polygons.length,
      circles: circles.length,
      elevations: elevations.length,
      infrastructures: infrastructures.length,
      sectors: sectors.length
    });

    res.json({ success: true, data: allData, count: allData.length });
  } catch (error) {
    console.error('Get all data error:', error);
    res.status(500).json({ success: false, error: 'Failed to get data' });
  }
};

/**
 * @route   POST /api/datahub/import
 * @desc    Import data (user-wise)
 * @access  Private
 */
const importData = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      import_type,
      file_name,
      file_size,
      region_id,
      import_settings
    } = req.body;

    if (!import_type || !file_name) {
      return res.status(400).json({
        success: false,
        error: 'Import type and file name required'
      });
    }

    const validTypes = ['geojson', 'kml', 'csv', 'excel', 'shapefile'];
    if (!validTypes.includes(import_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid import type. Must be: geojson, kml, csv, excel, or shapefile'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO data_hub_imports
       (user_id, region_id, import_type, file_name, file_size,
        import_status, import_settings)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        userId,
        region_id,
        import_type,
        file_name,
        file_size,
        import_settings ? JSON.stringify(import_settings) : null
      ]
    );

    // Placeholder - implement actual import logic here
    // Update status to processing, then completed
    setTimeout(async () => {
      await pool.query(
        `UPDATE data_hub_imports
         SET import_status = 'completed', records_imported = 0, completed_at = NOW()
         WHERE id = ?`,
        [result.insertId]
      );
    }, 1000);

    res.status(201).json({
      success: true,
      import_id: result.insertId,
      status: 'pending',
      message: 'Import started'
    });
  } catch (error) {
    console.error('Import data error:', error);
    res.status(500).json({ success: false, error: 'Failed to import data' });
  }
};

/**
 * @route   GET /api/datahub/imports
 * @desc    Get import history (user-wise)
 * @access  Private
 */
const getImportHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const [imports] = await pool.query(
      `SELECT * FROM data_hub_imports
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, imports, count: imports.length });
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
       WHERE user_id = ?
       AND (expires_at IS NULL OR expires_at > NOW())
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
       AND (expires_at IS NULL OR expires_at > NOW())`,
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

module.exports = {
  getAllData,
  importData,
  getImportHistory,
  exportData,
  getExportHistory,
  downloadExport
};
