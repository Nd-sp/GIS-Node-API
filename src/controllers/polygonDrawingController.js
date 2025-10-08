const { pool } = require('../config/database');

/**
 * @route   GET /api/drawings/polygon
 * @desc    Get all user's polygon drawings
 * @access  Private
 */
const getAllPolygons = async (req, res) => {
  try {
    const userId = req.user.id;
    const { regionId } = req.query;

    let query = 'SELECT * FROM polygon_drawings WHERE user_id = ?';
    const params = [userId];

    if (regionId) {
      query += ' AND region_id = ?';
      params.push(regionId);
    }

    query += ' ORDER BY created_at DESC';

    const [polygons] = await pool.query(query, params);

    res.json({ success: true, polygons });
  } catch (error) {
    console.error('Get polygons error:', error);
    res.status(500).json({ success: false, error: 'Failed to get polygons' });
  }
};

/**
 * @route   GET /api/drawings/polygon/:id
 * @desc    Get polygon by ID
 * @access  Private
 */
const getPolygonById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [polygons] = await pool.query(
      'SELECT * FROM polygon_drawings WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (polygons.length === 0) {
      return res.status(404).json({ success: false, error: 'Polygon not found' });
    }

    res.json({ success: true, polygon: polygons[0] });
  } catch (error) {
    console.error('Get polygon error:', error);
    res.status(500).json({ success: false, error: 'Failed to get polygon' });
  }
};

/**
 * @route   POST /api/drawings/polygon
 * @desc    Create polygon drawing
 * @access  Private
 */
const createPolygon = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      polygon_name,
      coordinates,
      area,
      perimeter,
      fill_color,
      stroke_color,
      opacity,
      properties,
      region_id,
      notes,
      is_saved
    } = req.body;

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ success: false, error: 'Valid coordinates array required' });
    }

    const [result] = await pool.query(
      `INSERT INTO polygon_drawings
       (user_id, region_id, polygon_name, coordinates, area, perimeter,
        fill_color, stroke_color, opacity, properties, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        region_id,
        polygon_name,
        JSON.stringify(coordinates),
        area,
        perimeter,
        fill_color || '#3388ff',
        stroke_color || '#3388ff',
        opacity || 0.5,
        properties ? JSON.stringify(properties) : null,
        notes,
        is_saved || false
      ]
    );

    res.status(201).json({
      success: true,
      polygon: {
        id: result.insertId,
        polygon_name,
        area,
        perimeter
      }
    });
  } catch (error) {
    console.error('Create polygon error:', error);
    res.status(500).json({ success: false, error: 'Failed to create polygon' });
  }
};

/**
 * @route   PUT /api/drawings/polygon/:id
 * @desc    Update polygon
 * @access  Private
 */
const updatePolygon = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { polygon_name, fill_color, stroke_color, opacity, notes, is_saved } = req.body;

    const updates = [];
    const params = [];

    if (polygon_name) {
      updates.push('polygon_name = ?');
      params.push(polygon_name);
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
      `UPDATE polygon_drawings SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    res.json({ success: true, message: 'Polygon updated successfully' });
  } catch (error) {
    console.error('Update polygon error:', error);
    res.status(500).json({ success: false, error: 'Failed to update polygon' });
  }
};

/**
 * @route   DELETE /api/drawings/polygon/:id
 * @desc    Delete polygon
 * @access  Private
 */
const deletePolygon = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query('DELETE FROM polygon_drawings WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Polygon deleted successfully' });
  } catch (error) {
    console.error('Delete polygon error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete polygon' });
  }
};

module.exports = {
  getAllPolygons,
  getPolygonById,
  createPolygon,
  updatePolygon,
  deletePolygon
};
