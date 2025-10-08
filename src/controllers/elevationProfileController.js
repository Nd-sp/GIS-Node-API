const { pool } = require('../config/database');

/**
 * @route   GET /api/elevation/profiles
 * @desc    Get all user's elevation profiles
 * @access  Private
 */
const getAllProfiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const { regionId } = req.query;

    let query = 'SELECT * FROM elevation_profiles WHERE user_id = ?';
    const params = [userId];

    if (regionId) {
      query += ' AND region_id = ?';
      params.push(regionId);
    }

    query += ' ORDER BY created_at DESC';

    const [profiles] = await pool.query(query, params);

    res.json({ success: true, profiles });
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profiles' });
  }
};

/**
 * @route   GET /api/elevation/profiles/:id
 * @desc    Get elevation profile by ID
 * @access  Private
 */
const getProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [profiles] = await pool.query(
      'SELECT * FROM elevation_profiles WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    res.json({ success: true, profile: profiles[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
};

/**
 * @route   POST /api/elevation/profiles
 * @desc    Create elevation profile
 * @access  Private
 */
const createProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      profile_name,
      start_point,
      end_point,
      elevation_data,
      total_distance,
      min_elevation,
      max_elevation,
      elevation_gain,
      elevation_loss,
      region_id,
      notes,
      is_saved
    } = req.body;

    if (!start_point || !end_point) {
      return res.status(400).json({
        success: false,
        error: 'Start and end points required'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO elevation_profiles
       (user_id, region_id, profile_name, start_point, end_point, elevation_data,
        total_distance, min_elevation, max_elevation, elevation_gain, elevation_loss,
        notes, is_saved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        region_id,
        profile_name,
        JSON.stringify(start_point),
        JSON.stringify(end_point),
        elevation_data ? JSON.stringify(elevation_data) : null,
        total_distance,
        min_elevation,
        max_elevation,
        elevation_gain,
        elevation_loss,
        notes,
        is_saved || false
      ]
    );

    res.status(201).json({
      success: true,
      profile: {
        id: result.insertId,
        profile_name,
        total_distance,
        elevation_gain
      }
    });
  } catch (error) {
    console.error('Create profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to create profile' });
  }
};

/**
 * @route   DELETE /api/elevation/profiles/:id
 * @desc    Delete elevation profile
 * @access  Private
 */
const deleteProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await pool.query('DELETE FROM elevation_profiles WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete profile' });
  }
};

/**
 * @route   POST /api/elevation/calculate
 * @desc    Calculate elevation data (placeholder for Google Elevation API integration)
 * @access  Private
 */
const calculateElevation = async (req, res) => {
  try {
    const { start_point, end_point, samples } = req.body;

    if (!start_point || !end_point) {
      return res.status(400).json({
        success: false,
        error: 'Start and end points required'
      });
    }

    // Placeholder - integrate with Google Elevation API or similar service
    const elevationData = {
      points: [
        { distance: 0, elevation: 100 },
        { distance: 500, elevation: 150 },
        { distance: 1000, elevation: 120 }
      ],
      total_distance: 1000,
      min_elevation: 100,
      max_elevation: 150,
      elevation_gain: 50,
      elevation_loss: 30
    };

    res.json({ success: true, data: elevationData });
  } catch (error) {
    console.error('Calculate elevation error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate elevation' });
  }
};

module.exports = {
  getAllProfiles,
  getProfileById,
  createProfile,
  deleteProfile,
  calculateElevation
};
