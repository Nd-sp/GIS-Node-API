const { pool } = require('../config/database');
const { logAudit } = require('./auditController');

/**
 * @route   GET /api/measurements/distance
 * @desc    Get all user's distance measurements
 * @access  Private
 */
const getAllMeasurements = async (req, res) => {
  try {
    const currentUserId = req.user.id;
const currentUserRole = (req.user.role || '').toLowerCase();
    const { regionId, filter, userId: filterUserId } = req.query;

    console.log('📏 Distance measurements request:', {
      currentUserId,
      currentUserRole,
      filter,
      filterUserId
    });

    // Base query with username join
    let query = `
      SELECT dm.*, u.username as username
      FROM distance_measurements dm
      LEFT JOIN users u ON dm.user_id = u.id
    `;
    let params = [];
    let whereConditions = [];

    // Apply filtering logic
if (filter === 'all' && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
      // Admin/Manager viewing all users' data - no user filter
      console.log('📏 Admin/Manager viewing ALL users data');
} else if (filter === 'user' && (currentUserRole === 'admin' || currentUserRole === 'manager') && filterUserId) {
      // Admin/Manager viewing specific user's data
      whereConditions.push('dm.user_id = ?');
      params.push(parseInt(filterUserId));
      console.log('📏 Admin/Manager viewing user', filterUserId);
    } else {
      // Default: current user's data only
      whereConditions.push('dm.user_id = ?');
      params.push(currentUserId);
      console.log('📏 User viewing own data only');
    }

    // Add region filter if specified
    if (regionId) {
      whereConditions.push('dm.region_id = ?');
      params.push(regionId);
    }

    // Build final query
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    query += ' ORDER BY dm.created_at DESC';

    console.log('📏 Final query:', query);
    console.log('📏 Query params:', params);

    const [measurements] = await pool.query(query, params);

    console.log('📏 Found measurements:', measurements.length);

    res.json({ success: true, measurements });
  } catch (error) {
    console.error('Get measurements error:', error);
    res.status(500).json({ success: false, error: 'Failed to get measurements' });
  }
};

/**
 * @route   GET /api/measurements/distance/:id
 * @desc    Get measurement by ID
 * @access  Private
 */
const getMeasurementById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [measurements] = await pool.query(
      'SELECT * FROM distance_measurements WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (measurements.length === 0) {
      return res.status(404).json({ success: false, error: 'Measurement not found' });
    }

    res.json({ success: true, measurement: measurements[0] });
  } catch (error) {
    console.error('Get measurement error:', error);
    res.status(500).json({ success: false, error: 'Failed to get measurement' });
  }
};

/**
 * @route   POST /api/measurements/distance
 * @desc    Create distance measurement
 * @access  Private
 */
const createMeasurement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { measurement_name, points, total_distance, unit, region_id, notes, is_saved } = req.body;

    if (!points || !total_distance) {
      return res.status(400).json({ success: false, error: 'Points and distance required' });
    }

    const [result] = await pool.query(
      `INSERT INTO distance_measurements
       (user_id, region_id, measurement_name, points, total_distance, unit, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, region_id, measurement_name, JSON.stringify(points), total_distance, unit || 'kilometers', notes, is_saved || false]
    );

    // Log audit
    await logAudit(userId, 'CREATE', 'distance_measurement', result.insertId, {
      measurement_name,
      total_distance,
      unit: unit || 'kilometers',
      points_count: points?.length || 0
    }, req);

    res.status(201).json({
      success: true,
      measurement: {
        id: result.insertId,
        measurement_name,
        total_distance,
        unit: unit || 'kilometers'
      }
    });
  } catch (error) {
    console.error('Create measurement error:', error);
    res.status(500).json({ success: false, error: 'Failed to create measurement' });
  }
};

/**
 * @route   PUT /api/measurements/distance/:id
 * @desc    Update measurement
 * @access  Private
 */
const updateMeasurement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { measurement_name, notes, is_saved } = req.body;

    const updates = [];
    const params = [];

    if (measurement_name) {
      updates.push('measurement_name = ?');
      params.push(measurement_name);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (is_saved !== undefined) {
      updates.push('is_saved = ?');
      params.push(is_saved);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id, userId);

    await pool.query(
      `UPDATE distance_measurements SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    // Log audit
    await logAudit(userId, 'UPDATE', 'distance_measurement', id, {
      updated_fields: { measurement_name, notes, is_saved }
    }, req);

    res.json({ success: true, message: 'Measurement updated successfully' });
  } catch (error) {
    console.error('Update measurement error:', error);
    res.status(500).json({ success: false, error: 'Failed to update measurement' });
  }
};

/**
 * @route   DELETE /api/measurements/distance/:id
 * @desc    Delete measurement
 * @access  Private
 */
const deleteMeasurement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get measurement details before deletion for audit log
    const [measurements] = await pool.query(
      'SELECT measurement_name, total_distance FROM distance_measurements WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    await pool.query('DELETE FROM distance_measurements WHERE id = ? AND user_id = ?', [id, userId]);

    // Log audit
    if (measurements.length > 0) {
      await logAudit(userId, 'DELETE', 'distance_measurement', id, {
        measurement_name: measurements[0].measurement_name,
        total_distance: measurements[0].total_distance
      }, req);
    }

    res.json({ success: true, message: 'Measurement deleted successfully' });
  } catch (error) {
    console.error('Delete measurement error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete measurement' });
  }
};

module.exports = {
  getAllMeasurements,
  getMeasurementById,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement
};
