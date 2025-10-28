const { pool } = require('../config/database');

/**
 * @route   GET /api/preferences
 * @desc    Get user's map preferences
 * @access  Private
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const [preferences] = await pool.query(
      'SELECT * FROM user_map_preferences WHERE user_id = ?',
      [userId]
    );

    if (preferences.length === 0) {
      // Return default preferences
      return res.json({
        success: true,
        preferences: {
          default_map_type: 'roadmap',
          default_zoom: 10,
          default_center: { lat: 28.6139, lng: 77.2090 },
          theme: 'auto',
          measurement_unit: 'metric',
          show_coordinates: true,
          show_scale: true,
          auto_save_enabled: true,
          notifications_enabled: true
        }
      });
    }

    // Parse JSON fields
    const prefs = preferences[0];
    if (prefs.default_center) {
      prefs.default_center = JSON.parse(prefs.default_center);
    }
    if (prefs.preferences) {
      prefs.preferences = JSON.parse(prefs.preferences);
    }

    res.json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
};

/**
 * @route   PUT /api/preferences
 * @desc    Update user preferences
 * @access  Private
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      default_map_type,
      default_zoom,
      default_center,
      default_region_id,
      theme,
      measurement_unit,
      show_coordinates,
      show_scale,
      auto_save_enabled,
      notifications_enabled,
      preferences
    } = req.body;

    // Check if preferences exist
    const [existing] = await pool.query(
      'SELECT id FROM user_map_preferences WHERE user_id = ?',
      [userId]
    );

    const fields = {
      default_map_type,
      default_zoom,
      default_center: default_center ? JSON.stringify(default_center) : undefined,
      default_region_id,
      theme,
      measurement_unit,
      show_coordinates,
      show_scale,
      auto_save_enabled,
      notifications_enabled,
      preferences: preferences ? JSON.stringify(preferences) : undefined
    };

    // Remove undefined fields
    const updateFields = {};
    Object.keys(fields).forEach(key => {
      if (fields[key] !== undefined) {
        updateFields[key] = fields[key];
      }
    });

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    if (existing.length === 0) {
      // Create new preferences
      updateFields.user_id = userId;
      const columns = Object.keys(updateFields).join(', ');
      const placeholders = Object.keys(updateFields).map(() => '?').join(', ');
      const values = Object.values(updateFields);

      await pool.query(
        `INSERT INTO user_map_preferences (${columns}) VALUES (${placeholders})`,
        values
      );
    } else {
      // Update existing preferences
      const updates = Object.keys(updateFields).map(key => `${key} = ?`);
      const values = [...Object.values(updateFields), userId];

      await pool.query(
        `UPDATE user_map_preferences SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
        values
      );
    }

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
};

/**
 * @route   DELETE /api/preferences
 * @desc    Reset preferences to defaults
 * @access  Private
 */
const resetPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query('DELETE FROM user_map_preferences WHERE user_id = ?', [userId]);

    res.json({
      success: true,
      message: 'Preferences reset to defaults'
    });
  } catch (error) {
    console.error('Reset preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset preferences' });
  }
};

module.exports = {
  getPreferences,
  updatePreferences,
  resetPreferences
};
