const { pool } = require('../config/database');
const { logAudit } = require('./auditController');

/**
 * @route   GET /api/drawings/circle
 * @desc    Get all user's circle drawings
 * @access  Private
 */
const getAllCircles = async (req, res) => {
  try {
    const currentUserId = req.user.id;
const currentUserRole = (req.user.role || '').toLowerCase();
    const { regionId, filter, userId: filterUserId } = req.query;

    console.log('⭕ Circle drawings request:', {
      currentUserId,
      currentUserRole,
      filter,
      filterUserId
    });

    // Base query with username join
    let query = `
      SELECT cd.*, u.username as username
      FROM circle_drawings cd
      LEFT JOIN users u ON cd.user_id = u.id
    `;
    let params = [];
    let whereConditions = [];

    // Apply filtering logic
if (filter === 'all' && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
      console.log('⭕ Admin/Manager viewing ALL users data');
} else if (filter === 'user' && (currentUserRole === 'admin' || currentUserRole === 'manager') && filterUserId) {
      whereConditions.push('cd.user_id = ?');
      params.push(parseInt(filterUserId));
      console.log('⭕ Admin/Manager viewing user', filterUserId);
    } else {
      whereConditions.push('cd.user_id = ?');
      params.push(currentUserId);
      console.log('⭕ User viewing own data only');
    }

    if (regionId) {
      whereConditions.push('cd.region_id = ?');
      params.push(regionId);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    query += ' ORDER BY cd.created_at DESC';

    console.log('⭕ Final query:', query);
    console.log('⭕ Query params:', params);

    const [circles] = await pool.query(query, params);

    console.log('⭕ Found circles:', circles.length);

    res.json({ success: true, circles });
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get circles' });
  }
};

/**
 * @route   GET /api/drawings/circle/:id
 * @desc    Get circle by ID
 * @access  Private
 */
const getCircleById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [circles] = await pool.query(
      'SELECT * FROM circle_drawings WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (circles.length === 0) {
      return res.status(404).json({ success: false, error: 'Circle not found' });
    }

    res.json({ success: true, circle: circles[0] });
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ success: false, error: 'Failed to get circle' });
  }
};

/**
 * @route   POST /api/drawings/circle
 * @desc    Create circle drawing
 * @access  Private
 */
const createCircle = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      circle_name,
      center_lat,
      center_lng,
      radius,
      fill_color,
      stroke_color,
      opacity,
      properties,
      region_id,
      notes,
      is_saved
    } = req.body;

    if (!center_lat || !center_lng || !radius) {
      return res.status(400).json({
        success: false,
        error: 'Center coordinates and radius required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO circle_drawings
       (user_id, region_id, circle_name, center_lat, center_lng, radius,
        fill_color, stroke_color, opacity, properties, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        region_id,
        circle_name,
        center_lat,
        center_lng,
        radius,
        fill_color || '#3388ff',
        stroke_color || '#3388ff',
        opacity || 0.5,
        properties ? JSON.stringify(properties) : null,
        notes,
        is_saved || false
      ]
    );

    // Log audit
    await logAudit(userId, 'CREATE', 'circle_drawing', result.insertId, {
      circle_name,
      center_lat,
      center_lng,
      radius
    }, req);

    res.status(201).json({
      success: true,
      circle: {
        id: result.insertId,
        circle_name,
        center_lat,
        center_lng,
        radius
      }
    });
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ success: false, error: 'Failed to create circle' });
  }
};

/**
 * @route   PUT /api/drawings/circle/:id
 * @desc    Update circle
 * @access  Private
 */
const updateCircle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { circle_name, fill_color, stroke_color, opacity, notes, is_saved } = req.body;

    const updates = [];
    const params = [];

    if (circle_name) {
      updates.push('circle_name = ?');
      params.push(circle_name);
    }
    if (fill_color) {
      updates.push('fill_color = ?');
      params.push(fill_color);
    }
    if (stroke_color) {
      updates.push('stroke_color = ?');
      params.push(stroke_color);
    }
    if (opacity !== undefined) {
      updates.push('opacity = ?');
      params.push(opacity);
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
      `UPDATE circle_drawings SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    // Log audit
    await logAudit(userId, 'UPDATE', 'circle_drawing', id, {
      updated_fields: { circle_name, fill_color, stroke_color, opacity, notes, is_saved }
    }, req);

    res.json({ success: true, message: 'Circle updated successfully' });
  } catch (error) {
    console.error('Update circle error:', error);
    res.status(500).json({ success: false, error: 'Failed to update circle' });
  }
};

/**
 * @route   DELETE /api/drawings/circle/:id
 * @desc    Delete circle
 * @access  Private
 */
const deleteCircle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get circle details before deletion for audit log
    const [circles] = await pool.query(
      'SELECT circle_name, radius FROM circle_drawings WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    await pool.query('DELETE FROM circle_drawings WHERE id = ? AND user_id = ?', [id, userId]);

    // Log audit
    if (circles.length > 0) {
      await logAudit(userId, 'DELETE', 'circle_drawing', id, {
        circle_name: circles[0].circle_name,
        radius: circles[0].radius
      }, req);
    }

    res.json({ success: true, message: 'Circle deleted successfully' });
  } catch (error) {
    console.error('Delete circle error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete circle' });
  }
};

module.exports = {
  getAllCircles,
  getCircleById,
  createCircle,
  updateCircle,
  deleteCircle
};
