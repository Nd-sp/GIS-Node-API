const { pool } = require('../config/database');

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
      `SELECT ta.id, ta.user_id, ta.resource_id, r.name as region_name,
              u.username, u.full_name
       FROM temporary_access ta
       INNER JOIN regions r ON ta.resource_id = r.id
       INNER JOIN users u ON ta.user_id = u.id
       WHERE ta.resource_type = 'region'
         AND ta.revoked_at IS NULL
         AND ta.expires_at <= UTC_TIMESTAMP()`
    );

    if (expiredAccess.length === 0) {
      console.log('✅ No expired temporary access found');
      return { cleanedCount: 0, expiredGrants: [] };
    }

    console.log(`⏰ Found ${expiredAccess.length} expired temporary access grant(s)`);

    let cleanedCount = 0;
    const expiredGrants = [];

    for (const access of expiredAccess) {
      const { user_id, resource_id, region_name, username, full_name } = access;

      // Check if there are any OTHER active temporary access grants for this user-region combo
      const [otherActiveGrants] = await pool.query(
        `SELECT id FROM temporary_access
         WHERE user_id = ? AND resource_id = ? AND resource_type = 'region'
         AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
        [user_id, resource_id]
      );

      // Only remove from user_regions if no other active temporary access exists
      if (otherActiveGrants.length === 0) {
        // Check if this is a temporary access entry (not permanent)
        // We identify temporary entries by checking if they exist in temporary_access table
        const [permanentAccess] = await pool.query(
          `SELECT ur.id FROM user_regions ur
           LEFT JOIN temporary_access ta ON ur.user_id = ta.user_id 
             AND ur.region_id = ta.resource_id 
             AND ta.resource_type = 'region'
             AND ta.revoked_at IS NULL
             AND ta.expires_at > UTC_TIMESTAMP()
           WHERE ur.user_id = ? AND ur.region_id = ?
             AND ta.id IS NULL`,
          [user_id, resource_id]
        );

        // Only delete if it's NOT a permanent access
        if (permanentAccess.length === 0) {
          await pool.query(
            'DELETE FROM user_regions WHERE user_id = ? AND region_id = ?',
            [user_id, resource_id]
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
 * Start the cleanup scheduler
 * Runs cleanup every 5 minutes
 */
const startCleanupScheduler = () => {
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

  console.log('🕒 Starting temporary access cleanup scheduler (runs every 5 minutes)');

  // Run immediately on startup
  cleanupExpiredTemporaryAccess().catch(error => {
    console.error('Initial cleanup failed:', error);
  });

  // Schedule recurring cleanup
  setInterval(async () => {
    try {
      await cleanupExpiredTemporaryAccess();
    } catch (error) {
      console.error('Scheduled cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL);
};

module.exports = {
  cleanupExpiredTemporaryAccess,
  startCleanupScheduler
};
