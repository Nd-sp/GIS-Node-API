const { pool } = require('../config/database');

/**
 * @route   GET /api/layers
 * @desc    Get all user's layers
 * @access  Private
 */
const getAllLayers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { regionId, layer_type } = req.query;

    let query = `SELECT * FROM layer_management
                 WHERE user_id = ? OR is_public = true
                 OR JSON_CONTAINS(shared_with, ?)`;
    const params = [userId, JSON.stringify(userId)];

    if (regionId) {
      query += ' AND region_id = ?';
      params.push(regionId);
    }
    if (layer_type) {
      query += ' AND layer_type = ?';
      params.push(layer_type);
    }

    query += ' ORDER BY created_at DESC';

    const [layers] = await pool.query(query, params);

    res.json({ success: true, layers });
  } catch (error) {
    console.error('Get layers error:', error);
    res.status(500).json({ success: false, error: 'Failed to get layers' });
  }
};

/**
 * @route   GET /api/layers/:id
 * @desc    Get layer by ID
 * @access  Private
 */
const getLayerById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [layers] = await pool.query(
      `SELECT * FROM layer_management
       WHERE id = ? AND (user_id = ? OR is_public = true OR JSON_CONTAINS(shared_with, ?))`,
      [id, userId, JSON.stringify(userId)]
    );

    if (layers.length === 0) {
      return res.status(404).json({ success: false, error: 'Layer not found or access denied' });
    }

    res.json({ success: true, layer: layers[0] });
  } catch (error) {
    console.error('Get layer error:', error);
    res.status(500).json({ success: false, error: 'Failed to get layer' });
  }
};

/**
 * @route   POST /api/layers
 * @desc    Save/create layer
 * @access  Private
 */
const createLayer = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      layer_name,
      layer_type,
      layer_data,
      is_visible,
      is_public,
      description,
      tags,
      region_id
    } = req.body;

    if (!layer_name || !layer_type || !layer_data) {
      return res.status(400).json({
        success: false,
        error: 'Layer name, type, and data required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO layer_management
       (user_id, region_id, layer_name, layer_type, layer_data, is_visible,
        is_public, description, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        region_id,
        layer_name,
        layer_type,
        JSON.stringify(layer_data),
        is_visible !== undefined ? is_visible : true,
        is_public || false,
        description,
        tags ? JSON.stringify(tags) : null
      ]
    );

    res.status(201).json({
      success: true,
      layer: {
        id: result.insertId,
        layer_name,
        layer_type
      }
    });
  } catch (error) {
    console.error('Create layer error:', error);
    res.status(500).json({ success: false, error: 'Failed to create layer' });
  }
};

/**
 * @route   PUT /api/layers/:id
 * @desc    Update layer
 * @access  Private
 */
const updateLayer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { layer_name, layer_data, is_public, description, tags } = req.body;

    const updates = [];
    const params = [];

    if (layer_name) {
      updates.push('layer_name = ?');
      params.push(layer_name);
    }
    if (layer_data) {
      updates.push('layer_data = ?');
      params.push(JSON.stringify(layer_data));
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      params.push(is_public);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (tags) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id, userId);

    await pool.query(
      `UPDATE layer_management SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    res.json({ success: true, message: 'Layer updated successfully' });
  } catch (error) {
    console.error('Update layer error:', error);
    res.status(500).json({ success: false, error: 'Failed to update layer' });
  }
};

/**
 * @route   DELETE /api/layers/:id
 * @desc    Delete layer
 * @access  Private
 */
const deleteLayer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query('DELETE FROM layer_management WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Layer deleted successfully' });
  } catch (error) {
    console.error('Delete layer error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete layer' });
  }
};

/**
 * @route   PATCH /api/layers/:id/visibility
 * @desc    Toggle layer visibility
 * @access  Private
 */
const toggleVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query(
      `UPDATE layer_management
       SET is_visible = NOT is_visible, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    res.json({ success: true, message: 'Visibility toggled successfully' });
  } catch (error) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle visibility' });
  }
};

/**
 * @route   POST /api/layers/:id/share
 * @desc    Share layer with other users
 * @access  Private
 */
const shareLayer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { user_ids } = req.body;

    if (!Array.isArray(user_ids)) {
      return res.status(400).json({
        success: false,
        error: 'user_ids must be an array'
      });
    }

    // Get current shared users
    const [layers] = await pool.query(
      'SELECT shared_with FROM layer_management WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (layers.length === 0) {
      return res.status(404).json({ success: false, error: 'Layer not found' });
    }

    let sharedWith = layers[0].shared_with ? JSON.parse(layers[0].shared_with) : [];
    sharedWith = [...new Set([...sharedWith, ...user_ids])]; // Merge and remove duplicates

    await pool.query(
      'UPDATE layer_management SET shared_with = ?, updated_at = NOW() WHERE id = ?',
      [JSON.stringify(sharedWith), id]
    );

    res.json({ success: true, message: 'Layer shared successfully', shared_with: sharedWith });
  } catch (error) {
    console.error('Share layer error:', error);
    res.status(500).json({ success: false, error: 'Failed to share layer' });
  }
};

module.exports = {
  getAllLayers,
  getLayerById,
  createLayer,
  updateLayer,
  deleteLayer,
  toggleVisibility,
  shareLayer
};
