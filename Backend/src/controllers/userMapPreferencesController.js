const { pool } = require('../config/database');

/**
 * Get user's map preferences
 * GET /api/user-map-preferences
 */
exports.getUserPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const [preferences] = await pool.query(
      'SELECT * FROM user_map_preferences WHERE user_id = ?',
      [userId]
    );

    if (preferences.length === 0) {
      // Return default preferences if none exist
      return res.json({
        success: true,
        preferences: {
          default_map_type: 'roadmap',
          default_zoom: 10,
          default_center: null,
          default_region_id: null,
          theme: 'auto',
          measurement_unit: 'metric',
          show_coordinates: true,
          show_scale: true,
          auto_save_enabled: true,
          notifications_enabled: true,
          preferences: {}
        }
      });
    }

    res.json({
      success: true,
      preferences: preferences[0]
    });
  } catch (error) {
    console.error('Error fetching user map preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch map preferences',
      error: error.message
    });
  }
};

/**
 * Save or update user's map preferences
 * POST /api/user-map-preferences
 */
exports.saveUserPreferences = async (req, res) => {
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

    // Check if preferences already exist
    const [existing] = await pool.query(
      'SELECT id FROM user_map_preferences WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      // Update existing preferences
      await pool.query(
        `UPDATE user_map_preferences SET
          default_map_type = COALESCE(?, default_map_type),
          default_zoom = COALESCE(?, default_zoom),
          default_center = COALESCE(?, default_center),
          default_region_id = COALESCE(?, default_region_id),
          theme = COALESCE(?, theme),
          measurement_unit = COALESCE(?, measurement_unit),
          show_coordinates = COALESCE(?, show_coordinates),
          show_scale = COALESCE(?, show_scale),
          auto_save_enabled = COALESCE(?, auto_save_enabled),
          notifications_enabled = COALESCE(?, notifications_enabled),
          preferences = COALESCE(?, preferences),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
        [
          default_map_type,
          default_zoom,
          default_center ? JSON.stringify(default_center) : null,
          default_region_id,
          theme,
          measurement_unit,
          show_coordinates,
          show_scale,
          auto_save_enabled,
          notifications_enabled,
          preferences ? JSON.stringify(preferences) : null,
          userId
        ]
      );
    } else {
      // Insert new preferences
      await pool.query(
        `INSERT INTO user_map_preferences
          (user_id, default_map_type, default_zoom, default_center, default_region_id,
           theme, measurement_unit, show_coordinates, show_scale, auto_save_enabled,
           notifications_enabled, preferences)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          default_map_type || 'roadmap',
          default_zoom || 10,
          default_center ? JSON.stringify(default_center) : null,
          default_region_id || null,
          theme || 'auto',
          measurement_unit || 'metric',
          show_coordinates !== undefined ? show_coordinates : true,
          show_scale !== undefined ? show_scale : true,
          auto_save_enabled !== undefined ? auto_save_enabled : true,
          notifications_enabled !== undefined ? notifications_enabled : true,
          preferences ? JSON.stringify(preferences) : null
        ]
      );
    }

    res.json({
      success: true,
      message: 'Map preferences saved successfully'
    });
  } catch (error) {
    console.error('Error saving user map preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save map preferences',
      error: error.message
    });
  }
};

/**
 * Reset user's map preferences to default
 * DELETE /api/user-map-preferences
 */
exports.resetUserPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM user_map_preferences WHERE user_id = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Map preferences reset to default'
    });
  } catch (error) {
    console.error('Error resetting user map preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset map preferences',
      error: error.message
    });
  }
};
