const { pool } = require('../config/database');

/**
 * @route   GET /api/regions
 * @desc    Get all regions (user's accessible regions)
 * @access  Private
 */
const getAllRegions = async (req, res) => {
  try {
    const { type, parentId } = req.query;
    const userId = req.user.id;

    let query = `
      SELECT DISTINCT r.id, r.name, r.code, r.type, r.parent_region_id,
             r.latitude, r.longitude, r.description, r.is_active, r.created_at
      FROM regions r
    `;

    const params = [];

    // Admin sees all regions, others see only their assigned regions
    if (req.user.role !== 'admin') {
      query += ` INNER JOIN user_regions ur ON r.id = ur.region_id WHERE ur.user_id = ? AND r.is_active = true`;
      params.push(userId);
    } else {
      query += ' WHERE r.is_active = true';
    }

    // Type filter
    if (type) {
      query += ' AND r.type = ?';
      params.push(type);
    }

    // Parent filter
    if (parentId) {
      query += ' AND r.parent_region_id = ?';
      params.push(parentId);
    }

    query += ' ORDER BY r.name';

    const [regions] = await pool.query(query, params);

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Get regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get regions' });
  }
};

/**
 * @route   GET /api/regions/:id
 * @desc    Get region by ID
 * @access  Private
 */
const getRegionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [regions] = await pool.query(
      'SELECT * FROM regions WHERE id = ?',
      [id]
    );

    if (regions.length === 0) {
      return res.status(404).json({ success: false, error: 'Region not found' });
    }

    res.json({ success: true, region: regions[0] });
  } catch (error) {
    console.error('Get region error:', error);
    res.status(500).json({ success: false, error: 'Failed to get region' });
  }
};

/**
 * @route   POST /api/regions
 * @desc    Create region
 * @access  Private (Admin)
 */
const createRegion = async (req, res) => {
  try {
    const { name, code, type, parentRegionId, latitude, longitude, description, boundary_geojson } = req.body;

    if (!name || !code || !type) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const [result] = await pool.query(
      `INSERT INTO regions (name, code, type, parent_region_id, latitude, longitude, description, boundary_geojson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code, type, parentRegionId, latitude, longitude, description, boundary_geojson]
    );

    res.status(201).json({
      success: true,
      region: {
        id: result.insertId,
        name,
        code,
        type
      }
    });
  } catch (error) {
    console.error('Create region error:', error);
    res.status(500).json({ success: false, error: 'Failed to create region' });
  }
};

/**
 * @route   PUT /api/regions/:id
 * @desc    Update region
 * @access  Private (Admin)
 */
const updateRegion = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, latitude, longitude, boundary_geojson } = req.body;

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description) {
      updates.push('description = ?');
      params.push(description);
    }
    if (latitude) {
      updates.push('latitude = ?');
      params.push(latitude);
    }
    if (longitude) {
      updates.push('longitude = ?');
      params.push(longitude);
    }
    if (boundary_geojson) {
      updates.push('boundary_geojson = ?');
      params.push(boundary_geojson);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.query(
      `UPDATE regions SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Region updated successfully' });
  } catch (error) {
    console.error('Update region error:', error);
    res.status(500).json({ success: false, error: 'Failed to update region' });
  }
};

/**
 * @route   DELETE /api/regions/:id
 * @desc    Delete region
 * @access  Private (Admin)
 */
const deleteRegion = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM regions WHERE id = ?', [id]);

    res.json({ success: true, message: 'Region deleted successfully' });
  } catch (error) {
    console.error('Delete region error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete region' });
  }
};

/**
 * @route   GET /api/regions/:id/children
 * @desc    Get child regions
 * @access  Private
 */
const getChildRegions = async (req, res) => {
  try {
    const { id } = req.params;

    const [regions] = await pool.query(
      'SELECT * FROM regions WHERE parent_region_id = ? AND is_active = true ORDER BY name',
      [id]
    );

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Get child regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get child regions' });
  }
};

/**
 * @route   GET /api/regions/:id/users
 * @desc    Get users in region
 * @access  Private (Manager/Admin)
 */
const getRegionUsers = async (req, res) => {
  try {
    const { id } = req.params;

    const [users] = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, ur.access_level
       FROM users u
       INNER JOIN user_regions ur ON u.id = ur.user_id
       WHERE ur.region_id = ? AND u.is_active = true`,
      [id]
    );

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get region users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get region users' });
  }
};

/**
 * @route   GET /api/regions/hierarchy
 * @desc    Get region hierarchy tree
 * @access  Private
 */
const getRegionHierarchy = async (req, res) => {
  try {
    const userId = req.user.id;
    let query = 'SELECT * FROM regions WHERE is_active = true';
    const params = [];

    // Non-admin users see only their regions
    if (req.user.role !== 'admin') {
      query = `
        SELECT DISTINCT r.*
        FROM regions r
        INNER JOIN user_regions ur ON r.id = ur.region_id
        WHERE ur.user_id = ? AND r.is_active = true
      `;
      params.push(userId);
    }

    const [regions] = await pool.query(query, params);

    // Build hierarchy tree
    const buildTree = (parentId = null) => {
      return regions
        .filter(r => r.parent_region_id === parentId)
        .map(r => ({
          ...r,
          children: buildTree(r.id)
        }));
    };

    const hierarchy = buildTree();

    res.json({ success: true, hierarchy });
  } catch (error) {
    console.error('Get hierarchy error:', error);
    res.status(500).json({ success: false, error: 'Failed to get hierarchy' });
  }
};

module.exports = {
  getAllRegions,
  getRegionById,
  createRegion,
  updateRegion,
  deleteRegion,
  getChildRegions,
  getRegionUsers,
  getRegionHierarchy
};
