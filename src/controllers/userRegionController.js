const { pool } = require('../config/database');
const { createNotification } = require('./notificationController');

/**
 * @route   GET /api/users/:id/regions
 * @desc    Get user's regions
 * @access  Private
 */
const getUserRegions = async (req, res) => {
  try {
    const { id } = req.params;

    const [regions] = await pool.query(
      `SELECT r.*, ur.access_level, ur.assigned_at
       FROM regions r
       INNER JOIN user_regions ur ON r.id = ur.region_id
       WHERE ur.user_id = ? AND r.is_active = true`,
      [id]
    );

    res.json({ success: true, regions });
  } catch (error) {
    console.error('Get user regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user regions' });
  }
};

/**
 * @route   POST /api/users/:id/regions
 * @desc    Assign region to user
 * @access  Private (Admin)
 */
const assignRegion = async (req, res) => {
  try {
    const { id } = req.params;
    const { regionId, accessLevel = 'read' } = req.body;

    if (!regionId) {
      return res.status(400).json({ success: false, error: 'Region ID required' });
    }

    await pool.query(
      `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_level = ?, assigned_by = ?`,
      [id, regionId, accessLevel, req.user.id, accessLevel, req.user.id]
    );

    // Get region and user info for notification
    const [regionInfo] = await pool.query('SELECT name FROM regions WHERE id = ?', [regionId]);
    const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [id]);

    const regionName = regionInfo[0]?.name || 'Unknown Region';
    const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

    // Notify the user about permanent region assignment
    try {
      await createNotification(
        id,
        'region_request',
        '🗺️ Region Assigned',
        `You have been assigned ${accessLevel} access to ${regionName}`,
        {
          data: {
            regionId,
            regionName,
            accessLevel,
            assignedBy: req.user.id
          },
          priority: 'medium',
          action_url: '/map',
          action_label: 'View Map'
        }
      );
      console.log(`📧 User ${userName} notified about region assignment: ${regionName}`);
    } catch (notifError) {
      console.error('Failed to send notification to user:', notifError);
    }

    res.json({ success: true, message: 'Region assigned successfully' });
  } catch (error) {
    console.error('Assign region error:', error);
    res.status(500).json({ success: false, error: 'Failed to assign region' });
  }
};

/**
 * @route   DELETE /api/users/:id/regions/:regionId
 * @desc    Unassign region from user
 * @access  Private (Admin)
 */
const unassignRegion = async (req, res) => {
  try {
    const { id, regionId } = req.params;

    // Get region and user info before deleting
    const [regionInfo] = await pool.query('SELECT name FROM regions WHERE id = ?', [regionId]);
    const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [id]);

    await pool.query(
      'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
      [id, regionId]
    );

    const regionName = regionInfo[0]?.name || 'Unknown Region';
    const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

    // Notify the user about region removal
    try {
      await createNotification(
        id,
        'region_request',
        '🗺️ Region Removed',
        `Your access to ${regionName} has been removed`,
        {
          data: {
            regionId,
            regionName,
            removedBy: req.user.id
          },
          priority: 'medium',
          action_url: '/regions',
          action_label: 'View Regions'
        }
      );
      console.log(`📧 User ${userName} notified about region removal: ${regionName}`);
    } catch (notifError) {
      console.error('Failed to send notification to user:', notifError);
    }

    res.json({ success: true, message: 'Region unassigned successfully' });
  } catch (error) {
    console.error('Unassign region error:', error);
    res.status(500).json({ success: false, error: 'Failed to unassign region' });
  }
};

module.exports = {
  getUserRegions,
  assignRegion,
  unassignRegion
};
