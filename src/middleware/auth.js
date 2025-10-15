const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/database');

/**
 * Authentication middleware - Verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth failed: No token provided');
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    console.log('🔑 Token received:', token.substring(0, 50) + '...');

    try {
      // Verify token
      const decoded = verifyToken(token);
      console.log('✅ Token decoded:', { id: decoded.id, email: decoded.email, role: decoded.role });

      // Get fresh user data from database
      const [users] = await pool.query(
        'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ?',
        [decoded.id]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = users[0];

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          error: 'User account is deactivated'
        });
      }

      // Add user to request object
      req.user = user;

      next();
    } catch (tokenError) {
      console.error('❌ Token verification failed:', tokenError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Authorization middleware - Check user role
 * @param {Array} allowedRoles - Array of allowed roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Check if user has access to region
 * @param {Number} regionId - Region ID to check
 */
const checkRegionAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const regionId = req.params.regionId || req.body.regionId || req.query.regionId;

    if (!regionId) {
      return next(); // No region specified, continue
    }

    // Admin has access to all regions
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has access to this region
    const [access] = await pool.query(
      'SELECT * FROM user_regions WHERE user_id = ? AND region_id = ? AND (expires_at IS NULL OR expires_at > NOW())',
      [userId, regionId]
    );

    if (access.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this region'
      });
    }

    req.regionAccess = access[0];
    next();
  } catch (error) {
    console.error('Region access check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify region access'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  checkRegionAccess
};
