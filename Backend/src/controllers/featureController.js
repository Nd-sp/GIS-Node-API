const { pool } = require('../config/database');

/**
 * @route   GET /api/features
 * @desc    Get all user's GIS features (filtered by regions)
 * @access  Private
 */
const getAllFeatures = async (req, res) => {
  try {
    const userId = req.user.id;
    const { region_id, feature_type, search } = req.query;

    let query = `
      SELECT DISTINCT f.*,
             u.username as created_by_username,
             r.name as region_name
      FROM gis_features f
      INNER JOIN users u ON f.created_by = u.id
      LEFT JOIN regions r ON f.region_id = r.id
      LEFT JOIN user_regions ur ON r.id = ur.region_id
      WHERE (f.created_by = ? OR ur.user_id = ?)
    `;
    const params = [userId, userId];

    if (region_id) {
      query += ' AND f.region_id = ?';
      params.push(region_id);
    }

    if (feature_type) {
      query += ' AND f.feature_type = ?';
      params.push(feature_type);
    }

    if (search) {
      query += ' AND (f.name LIKE ? OR f.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY f.created_at DESC';

    const [features] = await pool.query(query, params);

    res.json({ success: true, features });
  } catch (error) {
    console.error('Get features error:', error);
    res.status(500).json({ success: false, error: 'Failed to get features' });
  }
};

/**
 * @route   GET /api/features/:id
 * @desc    Get feature by ID
 * @access  Private
 */
const getFeatureById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [features] = await pool.query(
      `SELECT f.*,
              u.username as created_by_username,
              u.full_name as created_by_name,
              r.name as region_name,
              r.code as region_code
       FROM gis_features f
       INNER JOIN users u ON f.created_by = u.id
       LEFT JOIN regions r ON f.region_id = r.id
       LEFT JOIN user_regions ur ON r.id = ur.region_id
       WHERE f.id = ? AND (f.created_by = ? OR ur.user_id = ?)`,
      [id, userId, userId]
    );

    if (features.length === 0) {
      return res.status(404).json({ success: false, error: 'Feature not found' });
    }

    res.json({ success: true, feature: features[0] });
  } catch (error) {
    console.error('Get feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to get feature' });
  }
};

/**
 * @route   POST /api/features
 * @desc    Create GIS feature
 * @access  Private
 */
const createFeature = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      description,
      feature_type,
      geometry,
      latitude,
      longitude,
      properties,
      region_id,
      tags
    } = req.body;

    if (!name || !feature_type || !geometry) {
      return res.status(400).json({
        success: false,
        error: 'Name, feature_type, and geometry are required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO gis_features
       (name, description, feature_type, geometry, latitude, longitude,
        properties, region_id, tags, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        description,
        feature_type,
        JSON.stringify(geometry),
        latitude,
        longitude,
        properties ? JSON.stringify(properties) : null,
        region_id,
        tags ? JSON.stringify(tags) : null,
        userId
      ]
    );

    res.status(201).json({
      success: true,
      feature: {
        id: result.insertId,
        name,
        feature_type,
        latitude,
        longitude
      }
    });
  } catch (error) {
    console.error('Create feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to create feature' });
  }
};

/**
 * @route   PUT /api/features/:id
 * @desc    Update GIS feature (owner or admin)
 * @access  Private
 */
const updateFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const {
      name,
      description,
      properties,
      tags
    } = req.body;

    // Check ownership or admin
    const [features] = await pool.query(
      'SELECT created_by FROM gis_features WHERE id = ?',
      [id]
    );

    if (features.length === 0) {
      return res.status(404).json({ success: false, error: 'Feature not found' });
    }

    if (features[0].created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only feature owner or admin can update'
      });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (properties !== undefined) {
      updates.push('properties = ?');
      params.push(JSON.stringify(properties));
    }
    if (tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(tags));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    updates.push('updated_at = NOW()');
    params.push(id);

    await pool.query(
      `UPDATE gis_features SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Feature updated successfully' });
  } catch (error) {
    console.error('Update feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to update feature' });
  }
};

/**
 * @route   DELETE /api/features/:id
 * @desc    Delete GIS feature (owner or admin)
 * @access  Private
 */
const deleteFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check ownership or admin
    const [features] = await pool.query(
      'SELECT created_by FROM gis_features WHERE id = ?',
      [id]
    );

    if (features.length === 0) {
      return res.status(404).json({ success: false, error: 'Feature not found' });
    }

    if (features[0].created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only feature owner or admin can delete'
      });
    }

    await pool.query('DELETE FROM gis_features WHERE id = ?', [id]);

    res.json({ success: true, message: 'Feature deleted successfully' });
  } catch (error) {
    console.error('Delete feature error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete feature' });
  }
};

/**
 * @route   GET /api/features/nearby
 * @desc    Get nearby features (with lat/lng/radius query params)
 * @access  Private
 */
const getNearbyFeatures = async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, radius = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusMeters = parseFloat(radius);

    // Calculate using Haversine formula
    const [features] = await pool.query(
      `SELECT f.*,
              u.username as created_by_username,
              r.name as region_name,
              (6371000 * acos(
                cos(radians(?)) *
                cos(radians(f.latitude)) *
                cos(radians(f.longitude) - radians(?)) +
                sin(radians(?)) *
                sin(radians(f.latitude))
              )) AS distance
       FROM gis_features f
       INNER JOIN users u ON f.created_by = u.id
       LEFT JOIN regions r ON f.region_id = r.id
       LEFT JOIN user_regions ur ON r.id = ur.region_id
       WHERE (f.created_by = ? OR ur.user_id = ?)
       HAVING distance <= ?
       ORDER BY distance ASC`,
      [lat, lng, lat, userId, userId, radiusMeters]
    );

    res.json({ success: true, features, count: features.length });
  } catch (error) {
    console.error('Get nearby features error:', error);
    res.status(500).json({ success: false, error: 'Failed to get nearby features' });
  }
};

/**
 * @route   GET /api/features/region/:regionId
 * @desc    Get features by region
 * @access  Private
 */
const getFeaturesByRegion = async (req, res) => {
  try {
    const { regionId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this region
    const [access] = await pool.query(
      `SELECT id FROM user_regions WHERE user_id = ? AND region_id = ?`,
      [userId, regionId]
    );

    if (access.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No access to this region'
      });
    }

    const [features] = await pool.query(
      `SELECT f.*,
              u.username as created_by_username,
              r.name as region_name
       FROM gis_features f
       INNER JOIN users u ON f.created_by = u.id
       INNER JOIN regions r ON f.region_id = r.id
       WHERE f.region_id = ?
       ORDER BY f.created_at DESC`,
      [regionId]
    );

    res.json({ success: true, features });
  } catch (error) {
    console.error('Get features by region error:', error);
    res.status(500).json({ success: false, error: 'Failed to get features by region' });
  }
};

module.exports = {
  getAllFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
  getNearbyFeatures,
  getFeaturesByRegion
};
