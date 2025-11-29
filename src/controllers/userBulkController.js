const { pool } = require('../config/database');
const { logAudit } = require('./auditController');
const { createNotification } = require('./notificationController');

/**
 * @route   DELETE /api/users/bulk-delete
 * @desc    Bulk delete users
 * @access  Private (Admin)
 */
const bulkDeleteUsers = async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'User IDs array required' });
    }

    // Don't allow deleting self
    if (user_ids.includes(req.user.id)) {
      return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    }

    // Delete users
    const placeholders = user_ids.map(() => '?').join(',');
    const [result] = await pool.query(
      `DELETE FROM users WHERE id IN (${placeholders})`,
      user_ids
    );

    // Log audit
    await logAudit(req.user.id, 'BULK_DELETE', 'user', null, {
      action: 'bulk_delete',
      user_ids,
      count: result.affectedRows
    }, req);

    res.json({
      success: true,
      count: result.affectedRows,
      message: `${result.affectedRows} user(s) deleted successfully`
    });
  } catch (error) {
    console.error('Bulk delete users error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk delete users' });
  }
};

/**
 * @route   PATCH /api/users/bulk-status
 * @desc    Bulk update user status (activate/deactivate multiple users)
 * @access  Private (Admin)
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const { user_ids, is_active } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'User IDs array required' });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'is_active must be a boolean' });
    }

    // Don't allow deactivating self
    if (!is_active && user_ids.includes(req.user.id)) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
    }

    // Update user status
    const placeholders = user_ids.map(() => '?').join(',');
    const [result] = await pool.query(
      `UPDATE users SET is_active = ? WHERE id IN (${placeholders})`,
      [is_active, ...user_ids]
    );

    // Log audit
    const action = is_active ? 'activated' : 'deactivated';
    await logAudit(req.user.id, 'BULK_STATUS_UPDATE', 'user', null, {
      action: `bulk_${action}`,
      user_ids,
      is_active,
      count: result.affectedRows
    }, req);

    res.json({
      success: true,
      count: result.affectedRows,
      message: `${result.affectedRows} user(s) ${action} successfully`
    });
  } catch (error) {
    console.error('Bulk update status error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk update status' });
  }
};

/**
 * @route   POST /api/users/bulk-assign-regions
 * @desc    Bulk assign regions to multiple users
 * @access  Private (Admin)
 *
 * Actions:
 * - 'assign': Add regions to users (keeps existing regions)
 * - 'replace': Replace all user regions with new regions
 * - 'revoke': Remove specified regions from users
 */
const bulkAssignRegions = async (req, res) => {
  try {
    const { user_ids, region_names, action = 'assign' } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'User IDs array required' });
    }

    if (!region_names || !Array.isArray(region_names) || region_names.length === 0) {
      return res.status(400).json({ success: false, error: 'Region names array required' });
    }

    console.log('=== BULK ASSIGN REGIONS ===');
    console.log('Users:', user_ids);
    console.log('Regions:', region_names);
    console.log('Action:', action);

    const assignedBy = req.user ? req.user.id : null;
    let affectedUsers = 0;

    for (const userId of user_ids) {
      // Get existing regions before changes (for notification)
      const [existingRegionsBefore] = await pool.query(
        `SELECT r.name FROM regions r
         INNER JOIN user_regions ur ON r.id = ur.region_id
         WHERE ur.user_id = ?`,
        [userId]
      );
      const oldRegionNames = existingRegionsBefore.map(r => r.name);

      if (action === 'replace') {
        // Remove all existing regions for this user
        await pool.query('DELETE FROM user_regions WHERE user_id = ?', [userId]);
      }

      for (const regionName of region_names) {
        // Find or create region
        let [regions] = await pool.query(
          'SELECT id FROM regions WHERE name = ? AND is_active = true',
          [regionName]
        );

        let regionId;
        if (regions.length > 0) {
          regionId = regions[0].id;
        } else {
          // Create region
          const regionCode = (regionName.substring(0, 2) + regionName.charAt(regionName.length - 1)).toUpperCase();
          const [newRegion] = await pool.query(
            `INSERT INTO regions (name, code, type, is_active) VALUES (?, ?, 'state', true)`,
            [regionName, regionCode]
          );
          regionId = newRegion.insertId;
        }

        if (action === 'assign' || action === 'replace') {
          // Assign region
          await pool.query(
            `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
             VALUES (?, ?, 'read', ?)
             ON DUPLICATE KEY UPDATE assigned_by = ?`,
            [userId, regionId, assignedBy, assignedBy]
          );
        } else if (action === 'revoke') {
          // Revoke region
          await pool.query(
            'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
            [userId, regionId]
          );
        }
      }

      // Get new regions after changes (for notification)
      const [existingRegionsAfter] = await pool.query(
        `SELECT r.name FROM regions r
         INNER JOIN user_regions ur ON r.id = ur.region_id
         WHERE ur.user_id = ?`,
        [userId]
      );
      const newRegionNames = existingRegionsAfter.map(r => r.name);

      // Send notification to user about bulk region changes
      try {
        const [userInfo] = await pool.query('SELECT username, full_name FROM users WHERE id = ?', [userId]);
        const userName = userInfo[0]?.full_name || userInfo[0]?.username || 'User';

        let notificationTitle = '';
        let notificationMessage = '';

        if (action === 'assign') {
          const addedRegions = region_names.filter(r => !oldRegionNames.includes(r));
          if (addedRegions.length > 0) {
            notificationTitle = '🗺️ Regions Assigned (Bulk)';
            notificationMessage = `New regions have been assigned to you by an administrator.\n\n`;
            notificationMessage += `✅ Added: ${addedRegions.join(', ')}\n`;
            notificationMessage += `\nTotal regions: ${newRegionNames.join(', ')}`;
          }
        } else if (action === 'replace') {
          notificationTitle = '🗺️ Regions Replaced (Bulk)';
          notificationMessage = `Your regions have been replaced by an administrator.\n\n`;
          notificationMessage += `❌ Previous: ${oldRegionNames.length > 0 ? oldRegionNames.join(', ') : 'None'}\n`;
          notificationMessage += `✅ New: ${newRegionNames.length > 0 ? newRegionNames.join(', ') : 'None'}`;
        } else if (action === 'revoke') {
          const removedRegions = region_names.filter(r => oldRegionNames.includes(r));
          if (removedRegions.length > 0) {
            notificationTitle = '🗺️ Regions Revoked (Bulk)';
            notificationMessage = `Some regions have been revoked by an administrator.\n\n`;
            notificationMessage += `❌ Removed: ${removedRegions.join(', ')}\n`;
            notificationMessage += `\nRemaining regions: ${newRegionNames.length > 0 ? newRegionNames.join(', ') : 'None'}`;
          }
        }

        if (notificationMessage) {
          await createNotification(
            userId,
            'region_request',
            notificationTitle,
            notificationMessage,
            {
              data: {
                action,
                regions: region_names,
                oldRegions: oldRegionNames,
                newRegions: newRegionNames,
                bulkOperation: true,
                updatedBy: req.user?.full_name || req.user?.username
              },
              priority: 'medium',
              action_url: '/map',
              action_label: 'View Map'
            }
          );
          console.log(`📧 User ${userName} notified about bulk region ${action}`);
        }
      } catch (notifError) {
        console.error(`Failed to send bulk region notification to user ${userId}:`, notifError);
      }

      affectedUsers++;
    }

    res.json({
      success: true,
      message: `Regions ${action}ed for ${affectedUsers} user(s)`,
      affectedUsers
    });
  } catch (error) {
    console.error('Bulk assign regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk assign regions' });
  }
};

module.exports = {
  bulkDeleteUsers,
  bulkUpdateStatus,
  bulkAssignRegions
};
