const { pool } = require('../config/database');
const crypto = require('crypto');

/**
 * @route   POST /api/building-cache
 * @desc    Save building/obstacle data to cache
 * @access  Private
 */
const saveBuildingCache = async (req, res) => {
  try {
    const {
      bbox, // { south, north, west, east }
      building_data,
      obstacle_data
    } = req.body;

    if (!bbox || !building_data) {
      return res.status(400).json({
        success: false,
        error: 'Bounding box and building data required'
      });
    }

    // Generate cache key from bbox
    const cacheKey = generateCacheKey(bbox);

    // Calculate statistics
    const buildings = building_data.buildings || [];
    const buildingCount = buildings.length;
    const buildingsWithHeight = buildings.filter(b => !b.estimatedHeight).length;
    const confidenceScore = building_data.coverage?.confidenceScore || 0;

    // Check if cache already exists
    const [existing] = await pool.query(
      'SELECT id FROM building_cache WHERE cache_key = ?',
      [cacheKey]
    );

    if (existing.length > 0) {
      // Update existing cache
      await pool.query(
        `UPDATE building_cache
         SET building_data = ?,
             obstacle_data = ?,
             building_count = ?,
             buildings_with_height = ?,
             confidence_score = ?,
             last_accessed = CURRENT_TIMESTAMP,
             access_count = access_count + 1,
             expires_at = CURRENT_TIMESTAMP + INTERVAL 30 DAY
         WHERE cache_key = ?`,
        [
          JSON.stringify(building_data),
          obstacle_data ? JSON.stringify(obstacle_data) : null,
          buildingCount,
          buildingsWithHeight,
          confidenceScore,
          cacheKey
        ]
      );

      return res.json({
        success: true,
        message: 'Cache updated successfully',
        cacheKey,
        updated: true
      });
    }

    // Insert new cache entry
    await pool.query(
      `INSERT INTO building_cache
       (cache_key, bbox_south, bbox_north, bbox_west, bbox_east,
        building_data, obstacle_data, building_count, buildings_with_height,
        confidence_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cacheKey,
        bbox.south,
        bbox.north,
        bbox.west,
        bbox.east,
        JSON.stringify(building_data),
        obstacle_data ? JSON.stringify(obstacle_data) : null,
        buildingCount,
        buildingsWithHeight,
        confidenceScore
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Cache saved successfully',
      cacheKey,
      statistics: {
        buildingCount,
        buildingsWithHeight,
        confidenceScore
      }
    });
  } catch (error) {
    console.error('Save cache error:', error);
    res.status(500).json({ success: false, error: 'Failed to save cache' });
  }
};

/**
 * @route   GET /api/building-cache/:cacheKey
 * @desc    Get cached building data
 * @access  Private
 */
const getBuildingCache = async (req, res) => {
  try {
    const { cacheKey } = req.params;

    const [cached] = await pool.query(
      `SELECT building_data, obstacle_data, building_count,
              buildings_with_height, confidence_score, created_at
       FROM building_cache
       WHERE cache_key = ?
       AND expires_at > CURRENT_TIMESTAMP`,
      [cacheKey]
    );

    if (cached.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cache not found or expired'
      });
    }

    // Update access statistics
    await pool.query(
      `UPDATE building_cache
       SET last_accessed = CURRENT_TIMESTAMP,
           access_count = access_count + 1
       WHERE cache_key = ?`,
      [cacheKey]
    );

    res.json({
      success: true,
      cached: true,
      data: {
        building_data: cached[0].building_data,
        obstacle_data: cached[0].obstacle_data,
        statistics: {
          buildingCount: cached[0].building_count,
          buildingsWithHeight: cached[0].buildings_with_height,
          confidenceScore: cached[0].confidence_score
        },
        cachedAt: cached[0].created_at
      }
    });
  } catch (error) {
    console.error('Get cache error:', error);
    res.status(500).json({ success: false, error: 'Failed to get cache' });
  }
};

/**
 * @route   POST /api/building-cache/query
 * @desc    Query cache by bounding box
 * @access  Private
 */
const queryBuildingCache = async (req, res) => {
  try {
    const { bbox } = req.body;

    if (!bbox) {
      return res.status(400).json({
        success: false,
        error: 'Bounding box required'
      });
    }

    // Find overlapping cache entries
    const [cached] = await pool.query(
      `SELECT cache_key, building_data, obstacle_data,
              building_count, buildings_with_height, confidence_score,
              created_at, access_count
       FROM building_cache
       WHERE bbox_south <= ? AND bbox_north >= ?
       AND bbox_west <= ? AND bbox_east >= ?
       AND expires_at > CURRENT_TIMESTAMP
       ORDER BY confidence_score DESC
       LIMIT 1`,
      [bbox.north, bbox.south, bbox.east, bbox.west]
    );

    if (cached.length === 0) {
      return res.json({
        success: true,
        cached: false,
        message: 'No cache found for this area'
      });
    }

    // Update access statistics
    await pool.query(
      `UPDATE building_cache
       SET last_accessed = CURRENT_TIMESTAMP,
           access_count = access_count + 1
       WHERE cache_key = ?`,
      [cached[0].cache_key]
    );

    res.json({
      success: true,
      cached: true,
      cacheKey: cached[0].cache_key,
      data: {
        building_data: cached[0].building_data,
        obstacle_data: cached[0].obstacle_data,
        statistics: {
          buildingCount: cached[0].building_count,
          buildingsWithHeight: cached[0].buildings_with_height,
          confidenceScore: cached[0].confidence_score,
          accessCount: cached[0].access_count
        },
        cachedAt: cached[0].created_at
      }
    });
  } catch (error) {
    console.error('Query cache error:', error);
    res.status(500).json({ success: false, error: 'Failed to query cache' });
  }
};

/**
 * @route   DELETE /api/building-cache/cleanup
 * @desc    Clean up expired cache entries
 * @access  Private (Admin only)
 */
const cleanupExpiredCache = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const [result] = await pool.query(
      'DELETE FROM building_cache WHERE expires_at < CURRENT_TIMESTAMP'
    );

    res.json({
      success: true,
      message: `Cleaned up ${result.affectedRows} expired cache entries`
    });
  } catch (error) {
    console.error('Cleanup cache error:', error);
    res.status(500).json({ success: false, error: 'Failed to cleanup cache' });
  }
};

/**
 * @route   GET /api/building-cache/stats
 * @desc    Get cache statistics
 * @access  Private (Admin only)
 */
const getCacheStatistics = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();

    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_entries,
        SUM(building_count) as total_buildings,
        SUM(access_count) as total_accesses,
        AVG(confidence_score) as avg_confidence,
        COUNT(CASE WHEN expires_at < CURRENT_TIMESTAMP THEN 1 END) as expired_entries,
        COUNT(CASE WHEN expires_at >= CURRENT_TIMESTAMP THEN 1 END) as valid_entries
      FROM building_cache
    `);

    res.json({
      success: true,
      statistics: stats[0]
    });
  } catch (error) {
    console.error('Get cache stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate cache key from bounding box
 * Rounds to 4 decimal places (~11m precision) for better cache hits
 */
const generateCacheKey = (bbox) => {
  const rounded = {
    south: bbox.south.toFixed(4),
    north: bbox.north.toFixed(4),
    west: bbox.west.toFixed(4),
    east: bbox.east.toFixed(4)
  };

  const str = `${rounded.south}_${rounded.north}_${rounded.west}_${rounded.east}`;

  // Create hash for shorter key
  return crypto.createHash('md5').update(str).digest('hex');
};

module.exports = {
  saveBuildingCache,
  getBuildingCache,
  queryBuildingCache,
  cleanupExpiredCache,
  getCacheStatistics
};
