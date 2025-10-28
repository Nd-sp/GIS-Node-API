const { pool } = require('../config/database');
const { logAudit } = require('./auditController');

/**
 * @route   GET /api/elevation or /api/elevation/profiles
 * @desc    Get all elevation profiles (with optional user filtering for Admin/Manager)
 * @access  Private
 */
const getAllProfiles = async (req, res) => {
  try {
    const currentUserId = req.user.id;
const currentUserRole = (req.user.role || '').toLowerCase();
    const { regionId, filter, userId: filterUserId } = req.query;

    console.log('⛰️ Elevation profiles request:', {
      currentUserId,
      currentUserRole,
      filter,
      filterUserId
    });

    // Base query with username join
    let query = `
      SELECT ep.*, u.username as username, u.email as user_email
      FROM elevation_profiles ep
      LEFT JOIN users u ON ep.user_id = u.id
    `;
    let params = [];
    let whereConditions = [];

    // Apply filtering logic similar to other controllers
if (filter === 'all' && (currentUserRole === 'admin' || currentUserRole === 'manager')) {
      console.log('⛰️ Admin/Manager viewing ALL users data');
} else if (filter === 'user' && (currentUserRole === 'admin' || currentUserRole === 'manager') && filterUserId) {
      whereConditions.push('ep.user_id = ?');
      params.push(parseInt(filterUserId));
      console.log('⛰️ Admin/Manager viewing user', filterUserId);
    } else {
      whereConditions.push('ep.user_id = ?');
      params.push(currentUserId);
      console.log('⛰️ User viewing own data only');
    }

    if (regionId) {
      whereConditions.push('ep.region_id = ?');
      params.push(regionId);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    query += ' ORDER BY ep.created_at DESC';

    console.log('⛰️ Final query:', query);
    console.log('⛰️ Query params:', params);

    const [profiles] = await pool.query(query, params);

    console.log('⛰️ Found profiles:', profiles.length);

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

    // Log audit
    await logAudit(userId, 'CREATE', 'elevation_profile', result.insertId, {
      profile_name,
      total_distance,
      min_elevation,
      max_elevation,
      elevation_gain
    }, req);

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
 * @route   PUT /api/elevation/:id
 * @desc    Update elevation profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { profile_name, notes } = req.body;

    const updates = [];
    const params = [];

    if (profile_name !== undefined) {
      updates.push('profile_name = ?');
      params.push(profile_name);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id, userId);

    await pool.query(
      `UPDATE elevation_profiles SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    // Log audit
    await logAudit(userId, 'UPDATE', 'elevation_profile', id, {
      updated_fields: { profile_name, notes }
    }, req);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
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

    // Get profile details before deletion for audit log
    const [profiles] = await pool.query(
      'SELECT profile_name, total_distance, elevation_gain FROM elevation_profiles WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    await pool.query('DELETE FROM elevation_profiles WHERE id = ? AND user_id = ?', [id, userId]);

    // Log audit
    if (profiles.length > 0) {
      await logAudit(userId, 'DELETE', 'elevation_profile', id, {
        profile_name: profiles[0].profile_name,
        total_distance: profiles[0].total_distance,
        elevation_gain: profiles[0].elevation_gain
      }, req);
    }

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
  updateProfile,
  deleteProfile,
  calculateElevation
};
