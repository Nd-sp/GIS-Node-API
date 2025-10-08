const { pool } = require('../config/database');

/**
 * @route   GET /api/rf/sectors
 * @desc    Get all user's RF sectors
 * @access  Private
 */
const getAllSectors = async (req, res) => {
  try {
    const userId = req.user.id;
    const { regionId } = req.query;

    let query = 'SELECT * FROM sector_rf_data WHERE user_id = ?';
    const params = [userId];

    if (regionId) {
      query += ' AND region_id = ?';
      params.push(regionId);
    }

    query += ' ORDER BY created_at DESC';

    const [sectors] = await pool.query(query, params);

    res.json({ success: true, sectors });
  } catch (error) {
    console.error('Get sectors error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sectors' });
  }
};

/**
 * @route   GET /api/rf/sectors/:id
 * @desc    Get sector by ID
 * @access  Private
 */
const getSectorById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [sectors] = await pool.query(
      'SELECT * FROM sector_rf_data WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (sectors.length === 0) {
      return res.status(404).json({ success: false, error: 'Sector not found' });
    }

    res.json({ success: true, sector: sectors[0] });
  } catch (error) {
    console.error('Get sector error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sector' });
  }
};

/**
 * @route   POST /api/rf/sectors
 * @desc    Create RF sector
 * @access  Private
 */
const createSector = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      sector_name,
      tower_lat,
      tower_lng,
      azimuth,
      beamwidth,
      radius,
      frequency,
      power,
      antenna_height,
      antenna_type,
      fill_color,
      stroke_color,
      opacity,
      properties,
      region_id,
      notes,
      is_saved
    } = req.body;

    if (!tower_lat || !tower_lng || azimuth === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Tower coordinates and azimuth required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO sector_rf_data
       (user_id, region_id, sector_name, tower_lat, tower_lng, azimuth, beamwidth,
        radius, frequency, power, antenna_height, antenna_type, fill_color,
        stroke_color, opacity, properties, notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        region_id,
        sector_name,
        tower_lat,
        tower_lng,
        azimuth,
        beamwidth || 65,
        radius || 1000,
        frequency,
        power,
        antenna_height,
        antenna_type,
        fill_color || '#ff6b6b',
        stroke_color || '#ff6b6b',
        opacity || 0.4,
        properties ? JSON.stringify(properties) : null,
        notes,
        is_saved || false
      ]
    );

    res.status(201).json({
      success: true,
      sector: {
        id: result.insertId,
        sector_name,
        azimuth,
        beamwidth: beamwidth || 65,
        radius: radius || 1000
      }
    });
  } catch (error) {
    console.error('Create sector error:', error);
    res.status(500).json({ success: false, error: 'Failed to create sector' });
  }
};

/**
 * @route   PUT /api/rf/sectors/:id
 * @desc    Update sector
 * @access  Private
 */
const updateSector = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      sector_name,
      frequency,
      power,
      antenna_height,
      antenna_type,
      fill_color,
      stroke_color,
      opacity,
      notes,
      is_saved
    } = req.body;

    const updates = [];
    const params = [];

    if (sector_name) {
      updates.push('sector_name = ?');
      params.push(sector_name);
    }
    if (frequency !== undefined) {
      updates.push('frequency = ?');
      params.push(frequency);
    }
    if (power !== undefined) {
      updates.push('power = ?');
      params.push(power);
    }
    if (antenna_height !== undefined) {
      updates.push('antenna_height = ?');
      params.push(antenna_height);
    }
    if (antenna_type) {
      updates.push('antenna_type = ?');
      params.push(antenna_type);
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
      `UPDATE sector_rf_data SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    res.json({ success: true, message: 'Sector updated successfully' });
  } catch (error) {
    console.error('Update sector error:', error);
    res.status(500).json({ success: false, error: 'Failed to update sector' });
  }
};

/**
 * @route   DELETE /api/rf/sectors/:id
 * @desc    Delete sector
 * @access  Private
 */
const deleteSector = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query('DELETE FROM sector_rf_data WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Sector deleted successfully' });
  } catch (error) {
    console.error('Delete sector error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete sector' });
  }
};

/**
 * @route   POST /api/rf/sectors/:id/calculate
 * @desc    Calculate RF coverage (placeholder for future implementation)
 * @access  Private
 */
const calculateCoverage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify sector belongs to user
    const [sectors] = await pool.query(
      'SELECT * FROM sector_rf_data WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (sectors.length === 0) {
      return res.status(404).json({ success: false, error: 'Sector not found' });
    }

    const sector = sectors[0];

    // Placeholder calculation - implement RF propagation model here
    const coverage = {
      sector_id: id,
      predicted_range: sector.radius,
      coverage_area: Math.PI * Math.pow(sector.radius, 2),
      signal_strength: 'Good', // Placeholder
      interference_level: 'Low' // Placeholder
    };

    res.json({ success: true, coverage });
  } catch (error) {
    console.error('Calculate coverage error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate coverage' });
  }
};

module.exports = {
  getAllSectors,
  getSectorById,
  createSector,
  updateSector,
  deleteSector,
  calculateCoverage
};
