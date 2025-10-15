const { pool } = require('../config/database');
const { cleanupExpiredTemporaryAccess } = require('../utils/temporaryAccessCleanup');
const { logAudit } = require('./auditController');

/**
 * Calculate human-readable time remaining
 * @param {number} seconds - Seconds remaining until expiration
 * @returns {object} Time remaining breakdown
 */
const calculateTimeRemaining = (seconds) => {
  if (!seconds || seconds <= 0) {
    return {
      expired: true,
      display: 'Expired',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      total_seconds: 0
    };
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  let display = '';
  if (days > 0) display += `${days}d `;
  if (hours > 0) display += `${hours}h `;
  if (minutes > 0) display += `${minutes}m `;
  if (secs > 0 && days === 0) display += `${secs}s`;

  return {
    expired: false,
    display: display.trim() || 'Just now',
    days,
    hours,
    minutes,
    seconds: secs,
    total_seconds: seconds
  };
};

/**
 * @route   GET /api/temporary-access
 * @desc    Get all temporary access grants (admin/manager)
 * @access  Private (Admin/Manager)
 */
const getAllTemporaryAccess = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role?.toLowerCase(); // Case-insensitive role check

    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can view temporary access'
      });
    }

    const { status, user_id } = req.query;

    let query = `
      SELECT ta.*,
             u.username,
             u.full_name,
             u.email,
             r.name as region_name,
             r.code as region_code,
             granter.username as granted_by_username,
             TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), ta.expires_at) as seconds_remaining
      FROM temporary_access ta
      INNER JOIN users u ON ta.user_id = u.id
      INNER JOIN regions r ON ta.resource_id = r.id
      INNER JOIN users granter ON ta.granted_by = granter.id
      WHERE ta.resource_type = 'region'
    `;
    const params = [];

    if (status) {
      if (status === 'active') {
        query += ' AND ta.revoked_at IS NULL AND ta.expires_at > UTC_TIMESTAMP()';
      } else if (status === 'revoked') {
        query += ' AND ta.revoked_at IS NOT NULL';
      } else if (status === 'expired') {
        query += ' AND ta.revoked_at IS NULL AND ta.expires_at <= UTC_TIMESTAMP()';
      }
    }

    if (user_id) {
      query += ' AND ta.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY ta.granted_at DESC';

    const [access] = await pool.query(query, params);

    // Add time remaining calculation
    const accessWithTimeRemaining = access.map(grant => ({
      ...grant,
      time_remaining: calculateTimeRemaining(grant.seconds_remaining)
    }));

    res.json({ success: true, access: accessWithTimeRemaining });
  } catch (error) {
    console.error('Get temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to get temporary access' });
  }
};

/**
 * @route   POST /api/temporary-access
 * @desc    Grant temporary access to region (manager+)
 * @access  Private (Manager/Admin)
 */
const grantTemporaryAccess = async (req, res) => {
  try {
    const granterId = req.user.id;
    const granterRole = req.user.role?.toLowerCase(); // Case-insensitive role check

    if (granterRole !== 'admin' && granterRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can grant temporary access'
      });
    }

    const { user_id, region_name, access_level, expires_at, reason } = req.body;

    // Log the request body for debugging
    console.log('📨 Grant temporary access request:', {
      user_id,
      region_name,
      expires_at,
      access_level,
      reason
    });

    if (!user_id || !region_name || !expires_at) {
      console.log('❌ Validation failed:', {
        hasUserId: !!user_id,
        hasRegionName: !!region_name,
        hasExpiresAt: !!expires_at
      });
      return res.status(400).json({
        success: false,
        error: 'User ID, region name, and expires_at are required'
      });
    }

    // Verify user exists
    const [users] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Find region by name
    const [regions] = await pool.query('SELECT id FROM regions WHERE name = ? AND is_active = true', [region_name]);
    if (regions.length === 0) {
      return res.status(404).json({ success: false, error: 'Region not found' });
    }

    const regionId = regions[0].id;

    // Check if active temporary access already exists
    const [existingTemp] = await pool.query(
      `SELECT id FROM temporary_access
       WHERE user_id = ? AND resource_type = 'region' AND resource_id = ?
       AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [user_id, regionId]
    );

    if (existingTemp.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User already has active temporary access to this region'
      });
    }

    // Log received expires_at for debugging
    console.log('🕐 Expires_at received from frontend:', expires_at);
    console.log('🕐 Current server time (local):', new Date());
    console.log('🕐 Current server time (UTC):', new Date().toISOString());

    // Convert to UTC for consistent storage
    const expiresDate = new Date(expires_at);
    const mysqlDateTime = expiresDate.toISOString().slice(0, 19).replace('T', ' ');

    console.log('🕐 MySQL datetime being stored (UTC):', mysqlDateTime);
    console.log('🕐 Difference from now (minutes):', Math.round((expiresDate - new Date()) / 60000));

    const [result] = await pool.query(
      `INSERT INTO temporary_access
       (user_id, resource_type, resource_id, access_level, reason, granted_by, expires_at)
       VALUES (?, 'region', ?, ?, ?, ?, ?)`,
      [
        user_id,
        regionId,
        access_level || 'read',
        reason,
        granterId,
        mysqlDateTime
      ]
    );

    console.log(`✅ Created temporary access grant ID: ${result.insertId}`);
    console.log(`   User: ${users[0].full_name} (${user_id})`);
    console.log(`   Region: ${region_name} (${regionId})`);
    console.log(`   Expires: ${expires_at}`);

    // Also add temporary access to user_regions table for actual region access
    // This allows the user to access the region in the map
    await pool.query(
      `INSERT INTO user_regions (user_id, region_id, access_level, assigned_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE access_level = ?, assigned_by = ?`,
      [user_id, regionId, access_level || 'read', granterId, access_level || 'read', granterId]
    );

    console.log(`✅ Added region access to user_regions table for temporary access`);

    // Log audit event for granting temporary access
    try {
      await logAudit(
        granterId,
        `Granted temporary access to ${region_name} for ${users[0].full_name}`,
        'REGION_ASSIGNED',
        null, // resource_id as null, region name in details
        {
          severity: 'info',
          resource_name: region_name,
          target_user_id: user_id,
          target_user_name: users[0].full_name,
          target_user_email: users[0].email,
          access_level: access_level || 'read',
          expires_at: expires_at,
          reason: reason,
          grant_id: result.insertId,
          granted_by_role: granterRole,
          success: true
        },
        req
      );
      console.log('✅ Audit log created for temporary access grant');
    } catch (auditError) {
      console.error('Failed to create audit log for grant:', auditError);
      // Continue even if audit log fails
    }

    res.status(201).json({
      success: true,
      grant: {
        id: result.insertId,
        user_id,
        user_name: users[0].full_name,
        user_email: users[0].email,
        region_name,
        resource_id: regionId,
        access_level: access_level || 'read',
        granted_at: new Date(),
        expires_at,
        reason,
        granted_by: granterId,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Grant temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to grant temporary access' });
  }
};

/**
 * @route   DELETE /api/temporary-access/:id
 * @desc    Delete/Revoke temporary access (manager+)
 * @access  Private (Manager/Admin)
 */
const revokeTemporaryAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role?.toLowerCase(); // Case-insensitive role check

    if (userRole !== 'admin' && userRole !== 'manager') {
      return res.status(403).json({
        success: false,
        error: 'Only admin or manager can delete temporary access'
      });
    }

    // Get the grant details before deleting (with user and region info for audit log)
    const [access] = await pool.query(
      `SELECT ta.user_id, ta.resource_id, ta.revoked_at, ta.reason as grant_reason,
              u.username, u.full_name, u.email,
              r.name as region_name
       FROM temporary_access ta
       INNER JOIN users u ON ta.user_id = u.id
       INNER JOIN regions r ON ta.resource_id = r.id
       WHERE ta.id = ?`,
      [id]
    );

    if (access.length === 0) {
      return res.status(404).json({ success: false, error: 'Temporary access not found' });
    }

    const grantUserId = access[0].user_id;
    const grantResourceId = access[0].resource_id;
    const targetUser = {
      id: access[0].user_id,
      username: access[0].username,
      full_name: access[0].full_name,
      email: access[0].email
    };
    const regionName = access[0].region_name;

    // Delete the temporary access record from database
    await pool.query('DELETE FROM temporary_access WHERE id = ?', [id]);
    console.log(`✅ Deleted temporary access ID: ${id} from database`);
    console.log(`   Revoked by: ${req.user.username || userId} (ID: ${userId})`);
    console.log(`   Target user: ${targetUser.full_name} (ID: ${grantUserId})`);
    console.log(`   Region: ${regionName}`);

    // Log audit event for revocation
    try {
      await logAudit(
        userId,
        `Revoked temporary access to ${regionName} for ${targetUser.full_name}`,
        'REGION_REVOKED',
        null, // resource_id as null, region name in details
        {
          severity: 'warning',
          resource_name: regionName,
          target_user_id: grantUserId,
          target_username: targetUser.username,
          target_user_name: targetUser.full_name,
          grant_id: id,
          revoked_by_role: userRole,
          success: true
        },
        req
      );
      console.log('✅ Audit log created for temporary access revocation');
    } catch (auditError) {
      console.error('Failed to create audit log for revocation:', auditError);
      // Continue even if audit log fails
    }

    // Remove from user_regions table (only if no other active temporary access exists)
    // Check if there's any other active temporary access for this region
    const [otherTemp] = await pool.query(
      `SELECT id FROM temporary_access
       WHERE user_id = ? AND resource_id = ? AND resource_type = 'region'
       AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [grantUserId, grantResourceId]
    );

    // If no other temporary access, remove from user_regions
    if (otherTemp.length === 0) {
      await pool.query(
        'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
        [grantUserId, grantResourceId]
      );
      console.log(`✅ Removed temporary region access from user_regions`);
    }

    res.json({ success: true, message: 'Temporary access deleted successfully' });
  } catch (error) {
    console.error('Delete temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete temporary access' });
  }
};

/**
 * @route   GET /api/temporary-access/my-access
 * @desc    Get current user's active temporary access
 * @access  Private
 */
const getMyTemporaryAccess = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT ta.*,
             r.name as region_name,
             r.code as region_code,
             r.type as region_type,
             granter.username as granted_by_username,
             granter.full_name as granted_by_name,
             TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), ta.expires_at) as seconds_remaining
      FROM temporary_access ta
      INNER JOIN regions r ON ta.resource_id = r.id
      INNER JOIN users granter ON ta.granted_by = granter.id
      WHERE ta.user_id = ?
        AND ta.resource_type = 'region'
        AND ta.revoked_at IS NULL
        AND ta.expires_at > UTC_TIMESTAMP()
      ORDER BY ta.expires_at ASC
    `;

    const [access] = await pool.query(query, [userId]);

    // Add time remaining calculation
    const accessWithTimeRemaining = access.map(grant => ({
      ...grant,
      time_remaining: calculateTimeRemaining(grant.seconds_remaining)
    }));

    res.json({
      success: true,
      access: accessWithTimeRemaining,
      count: accessWithTimeRemaining.length
    });
  } catch (error) {
    console.error('Get my temporary access error:', error);
    res.status(500).json({ success: false, error: 'Failed to get temporary access' });
  }
};

/**
 * @route   GET /api/temporary-access/current-regions
 * @desc    Get user's currently valid regions (permanent + non-expired temporary)
 * @access  Private
 */
const getCurrentValidRegions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Step 1: Get all region IDs that have EVER had temporary access
    const [allTempRegions] = await pool.query(
      `SELECT DISTINCT resource_id FROM temporary_access
       WHERE user_id = ? AND resource_type = 'region'`,
      [userId]
    );
    const everTempRegionIds = allTempRegions.map(ta => ta.resource_id);

    // Step 2: Get all active temporary access (currently valid)
    const [activeTempAccess] = await pool.query(
      `SELECT resource_id, expires_at,
              TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at) as seconds_remaining
       FROM temporary_access
       WHERE user_id = ? AND resource_type = 'region'
       AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
      [userId]
    );
    const activeTempRegionIds = activeTempAccess.map(ta => ta.resource_id);
    const tempRegionMap = new Map(activeTempAccess.map(ta => [
      ta.resource_id,
      { expires_at: ta.expires_at, seconds_remaining: ta.seconds_remaining }
    ]));

    // Step 3: Get ALL regions from user_regions
    const query = `
      SELECT DISTINCT
        r.id,
        r.name,
        r.code,
        r.type,
        ur.access_level
      FROM regions r
      INNER JOIN user_regions ur ON r.id = ur.region_id
      WHERE ur.user_id = ?
        AND r.is_active = true
      ORDER BY r.name ASC
    `;

    const [regions] = await pool.query(query, [userId]);

    // Step 4: Filter and categorize regions
    const regionsWithDetails = regions
      .filter(region => {
        // If this region was EVER temporary
        if (everTempRegionIds.includes(region.id)) {
          // Only include if it has ACTIVE temporary access now
          return activeTempRegionIds.includes(region.id);
        }
        // If never had temporary access, it's permanent - always include
        return true;
      })
      .map(region => {
        const isTemporary = activeTempRegionIds.includes(region.id);
        const tempData = tempRegionMap.get(region.id);
        
        return {
          id: region.id,
          name: region.name,
          code: region.code,
          type: region.type,
          access_level: region.access_level,
          is_temporary: isTemporary,
          expires_at: isTemporary && tempData ? tempData.expires_at : null,
          time_remaining: isTemporary && tempData
            ? calculateTimeRemaining(tempData.seconds_remaining)
            : null
        };
      });

    res.json({
      success: true,
      regions: regionsWithDetails,
      count: regionsWithDetails.length
    });
  } catch (error) {
    console.error('Get current valid regions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get current regions' });
  }
};

/**
 * @route   POST /api/temporary-access/cleanup
 * @desc    Manually trigger cleanup of expired temporary access (Admin only)
 * @access  Private (Admin)
 */
const cleanupExpired = async (req, res) => {
  try {
    const userRole = req.user.role?.toLowerCase();

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin can trigger cleanup'
      });
    }

    const result = await cleanupExpiredTemporaryAccess();

    res.json({
      success: true,
      message: `Cleanup complete: Removed ${result.cleanedCount} expired temporary access grant(s)`,
      ...result
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup expired access' });
  }
};

module.exports = {
  getAllTemporaryAccess,
  grantTemporaryAccess,
  revokeTemporaryAccess,
  getMyTemporaryAccess,
  getCurrentValidRegions,
  cleanupExpired
};
