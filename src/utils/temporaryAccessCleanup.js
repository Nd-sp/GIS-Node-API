const { pool } = require('../config/database');
const { createNotification } = require('../controllers/notificationController');

/**
 * Clean up expired temporary access
 * This function:
 * 1. Finds all expired temporary access records
 * 2. Removes corresponding entries from user_regions table
 * 3. Logs the cleanup for audit purposes
 */
const cleanupExpiredTemporaryAccess = async () => {
  try {
    console.log('🧹 Starting cleanup of expired temporary access...');

    // Find all expired temporary access records
    const [expiredAccess] = await pool.query(
      `SELECT ta.id, ta.user_id, ta.region_id, r.name as region_name,
              u.username, u.full_name
       FROM temporary_access_log ta
       INNER JOIN regions r ON ta.region_id = r.id
       INNER JOIN users u ON ta.user_id = u.id
       WHERE ta.status != 'revoked'
         AND ta.end_time <= UTC_TIMESTAMP()`
    );

    if (expiredAccess.length === 0) {
      console.log('✅ No expired temporary access found');
      return { cleanedCount: 0, expiredGrants: [] };
    }

    console.log(`⏰ Found ${expiredAccess.length} expired temporary access grant(s)`);

    let cleanedCount = 0;
    const expiredGrants = [];

    for (const access of expiredAccess) {
      const { user_id, region_id, region_name, username, full_name } = access;

      // Check if there are any OTHER active temporary access grants for this user-region combo
      const [otherActiveGrants] = await pool.query(
        `SELECT id FROM temporary_access_log
         WHERE user_id = ? AND region_id = ?
         AND status != 'revoked' AND end_time > UTC_TIMESTAMP()`,
        [user_id, region_id]
      );

      // Only remove from user_regions if no other active temporary access exists
      if (otherActiveGrants.length === 0) {
        // Check if this is a temporary access entry (not permanent)
        // We identify temporary entries by checking if they exist in temporary_access table
        const [permanentAccess] = await pool.query(
          `SELECT ur.id FROM user_regions ur
           LEFT JOIN temporary_access_log ta ON ur.user_id = ta.user_id
             AND ur.region_id = ta.region_id

             AND ta.status != 'revoked'
             AND ta.end_time > UTC_TIMESTAMP()
           WHERE ur.user_id = ? AND ur.region_id = ?
             AND ta.id IS NULL`,
          [user_id, region_id]
        );

        // Only delete if it's NOT a permanent access
        if (permanentAccess.length === 0) {
          await pool.query(
            'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
            [user_id, region_id]
          );

          console.log(`  ✅ Removed expired temporary access: ${full_name} (${username}) -> ${region_name}`);
          cleanedCount++;
          expiredGrants.push({
            user_id,
            username,
            full_name,
            region_name
          });
        }
      }
    }

    console.log(`🧹 Cleanup complete: Removed ${cleanedCount} expired temporary access grant(s)`);

    return {
      cleanedCount,
      expiredGrants,
      totalExpired: expiredAccess.length
    };
  } catch (error) {
    console.error('❌ Error cleaning up expired temporary access:', error);
    throw error;
  }
};

/**
 * Check for temporary access expiring soon and send notifications
 * Notifies users 24 hours before their temporary access expires
 */
const notifyExpiringTemporaryAccess = async () => {
  try {
    console.log('⏰ Checking for temporary access expiring soon...');

    // Find temporary access that expires in the next 24-25 hours
    // We use a 1-hour window to avoid sending duplicate notifications
    const [expiringAccess] = await pool.query(
      `SELECT ta.id, ta.user_id, ta.region_id, ta.end_time,
              r.name as region_name, u.username, u.full_name,
              TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), ta.end_time) as hours_remaining
       FROM temporary_access_log ta
       INNER JOIN regions r ON ta.region_id = r.id 
       INNER JOIN users u ON ta.user_id = u.id
       WHERE ta.status != 'revoked'
         AND ta.end_time > UTC_TIMESTAMP()
         AND TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), ta.end_time) BETWEEN 23 AND 25`
    );

    if (expiringAccess.length === 0) {
      console.log('✅ No temporary access expiring in the next 24 hours');
      return { notifiedCount: 0 };
    }

    console.log(`⏰ Found ${expiringAccess.length} temporary access grant(s) expiring soon`);

    let notifiedCount = 0;

    for (const access of expiringAccess) {
      const { user_id, region_name, expires_at, full_name, hours_remaining } = access;

      try {
        // Check if we already sent a notification for this grant
        const [existingNotif] = await pool.query(
          `SELECT id FROM notifications WHERE user_id = ? AND type = 'region_request'
           AND title = '⏰ Temporary Access Expiring Soon'
           AND JSON_EXTRACT(data, '$.grantId') = ?
           AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 DAY)`,
          [user_id, access.id]
        );

        if (existingNotif.length > 0) {
          console.log(`  ⏭️  Already notified ${full_name} about ${region_name} expiring`);
          continue;
        }

        const expiryDate = new Date(expires_at);
        const expiryDisplay = expiryDate.toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        await createNotification(
          user_id,
          'region_request',
          '⏰ Temporary Access Expiring Soon',
          `Your temporary access to ${region_name} will expire in approximately ${hours_remaining} hours (${expiryDisplay})`,
          {
            data: {
              grantId: access.id,
              regionId: access.region_id,
              regionName: region_name,
              expiresAt: expires_at,
              hoursRemaining: hours_remaining
            },
            priority: 'medium',
            action_url: '/temporary-access',
            action_label: 'View Access',
            expires_at: expires_at
          }
        );

        console.log(`  ✅ Notified ${full_name} about ${region_name} expiring in ${hours_remaining}h`);
        notifiedCount++;
      } catch (notifError) {
        console.error(`  ❌ Failed to notify user ${user_id}:`, notifError);
      }
    }

    console.log(`⏰ Notification complete: Notified ${notifiedCount} user(s) about expiring access`);

    return {
      notifiedCount,
      totalExpiring: expiringAccess.length
    };
  } catch (error) {
    console.error('❌ Error notifying about expiring temporary access:', error);
    throw error;
  }
};

/**
 * Start the cleanup scheduler
 * Runs cleanup every 5 minutes and expiring notifications every hour
 */
const startCleanupScheduler = () => {
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
  const NOTIFICATION_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  console.log('🕒 Starting temporary access cleanup scheduler (runs every 5 minutes)');
  console.log('🕒 Starting temporary access expiration notification scheduler (runs every hour)');

  // Run immediately on startup
  cleanupExpiredTemporaryAccess().catch(error => {
    console.error('Initial cleanup failed:', error);
  });

  notifyExpiringTemporaryAccess().catch(error => {
    console.error('Initial notification check failed:', error);
  });

  // Schedule recurring cleanup
  setInterval(async () => {
    try {
      await cleanupExpiredTemporaryAccess();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL);

  // Schedule recurring expiration notifications
  setInterval(async () => {
    try {
      await notifyExpiringTemporaryAccess();
    } catch (error) {
      console.error('Scheduled notification check failed:', error);
    }
  }, NOTIFICATION_INTERVAL);
};

module.exports = {
  cleanupExpiredTemporaryAccess,
  notifyExpiringTemporaryAccess,
  startCleanupScheduler
};
