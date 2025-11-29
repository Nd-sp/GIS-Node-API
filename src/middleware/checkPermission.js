/**
 * Permission Enforcement Middleware
 * Checks if user has required permissions before allowing access
 */

const { pool } = require('../config/database');

/**
 * Get user's effective permissions (direct + from groups)
 * @param {number} userId - User ID
 * @returns {Promise<string[]>} - Array of permission IDs
 */
const getUserEffectivePermissions = async (userId) => {
  try {
    // Get direct permissions
    const [directPerms] = await pool.query(
      'SELECT permission_id FROM user_permissions WHERE user_id = ?',
      [userId]
    );

    // Get permissions from groups
    const [groupPerms] = await pool.query(
      `SELECT DISTINCT gp.permission_id
       FROM group_permissions gp
       INNER JOIN group_members gm ON gp.group_id = gm.group_id
       WHERE gm.user_id = ?`,
      [userId]
    );

    // Combine and deduplicate
    const allPermissions = [
      ...directPerms.map(p => p.permission_id),
      ...groupPerms.map(p => p.permission_id)
    ];

    return Array.from(new Set(allPermissions));
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
};

/**
 * Check if user has specific permission
 * @param {number} userId - User ID
 * @param {string} requiredPermission - Permission ID to check
 * @param {boolean} isAdmin - Whether user is admin
 * @returns {Promise<boolean>} - True if user has permission
 */
const hasPermission = async (userId, requiredPermission, isAdmin = false) => {
  // Admin has all permissions
  if (isAdmin) return true;

  const permissions = await getUserEffectivePermissions(userId);

  // Check for wildcard permission
  if (permissions.includes('*')) return true;

  // Check for exact permission match
  if (permissions.includes(requiredPermission)) return true;

  // Check for parent permission (e.g., 'users.view' covered by 'users.*')
  const permissionParts = requiredPermission.split('.');
  if (permissionParts.length > 1) {
    const parentPermission = permissionParts[0] + '.*';
    if (permissions.includes(parentPermission)) return true;
  }

  return false;
};

/**
 * Middleware to check if user has required permission
 * @param {string} requiredPermission - Permission ID required to access route
 * @returns {Function} - Express middleware function
 *
 * @example
 * router.get('/users', authenticate, checkPermission('users.view'), getUsers);
 * router.post('/users', authenticate, checkPermission('users.create'), createUser);
 */
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const isAdmin = userRole?.toLowerCase() === 'admin';

      // Check permission
      const allowed = await hasPermission(userId, requiredPermission, isAdmin);

      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: requiredPermission,
          message: `You need '${requiredPermission}' permission to access this resource`
        });
      }

      // User has permission, proceed
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking permissions'
      });
    }
  };
};

/**
 * Middleware to check if user has ANY of the required permissions
 * @param {string[]} permissions - Array of permission IDs (user needs at least one)
 * @returns {Function} - Express middleware function
 *
 * @example
 * router.get('/data', authenticate, checkAnyPermission(['data.view', 'data.admin']), getData);
 */
const checkAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const isAdmin = userRole?.toLowerCase() === 'admin';

      // Check if user has any of the required permissions
      for (const permission of permissions) {
        const allowed = await hasPermission(userId, permission, isAdmin);
        if (allowed) {
          return next(); // User has at least one permission
        }
      }

      // User doesn't have any required permission
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permissions,
        message: `You need one of these permissions: ${permissions.join(', ')}`
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking permissions'
      });
    }
  };
};

/**
 * Middleware to check if user has ALL of the required permissions
 * @param {string[]} permissions - Array of permission IDs (user needs all)
 * @returns {Function} - Express middleware function
 *
 * @example
 * router.post('/sensitive', authenticate, checkAllPermissions(['data.delete', 'admin.access']), deleteSensitiveData);
 */
const checkAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const isAdmin = userRole?.toLowerCase() === 'admin';

      // Check if user has all required permissions
      for (const permission of permissions) {
        const allowed = await hasPermission(userId, permission, isAdmin);
        if (!allowed) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            required: permissions,
            missing: permission,
            message: `You need all of these permissions: ${permissions.join(', ')}`
          });
        }
      }

      // User has all required permissions
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking permissions'
      });
    }
  };
};

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  hasPermission,
  getUserEffectivePermissions
};
