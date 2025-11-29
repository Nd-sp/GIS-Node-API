const { pool } = require('../config/database');

/**
 * Get user's search history
 * GET /api/search-history
 * Query params: limit (default: 20), offset (default: 0)
 */
exports.getSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const [history] = await pool.query(
      `SELECT * FROM search_history
       WHERE created_by = ?
       ORDER BY searched_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    // Get total count
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM search_history WHERE created_by = ?',
      [userId]
    );

    res.json({
      success: true,
      history,
      total: countResult[0].total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search history',
      error: error.message
    });
  }
};

/**
 * Get recent unique search queries
 * GET /api/search-history/recent
 * Query params: limit (default: 10)
 */
exports.getRecentSearches = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const [searches] = await pool.query(
      `SELECT DISTINCT search_query, search_type, MAX(searched_at) as last_searched
       FROM search_history
       WHERE created_by = ?
       GROUP BY search_query, search_type
       ORDER BY last_searched DESC
       LIMIT ?`,
      [userId, limit]
    );

    res.json({
      success: true,
      recent_searches: searches
    });
  } catch (error) {
    console.error('Error fetching recent searches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent searches',
      error: error.message
    });
  }
};

/**
 * Add search to history
 * POST /api/search-history
 */
exports.addSearchToHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { search_query, search_type, result_count } = req.body;

    if (!search_query || !search_type) {
      return res.status(400).json({
        success: false,
        message: 'search_query and search_type are required'
      });
    }

    // Validate search_type
    const validTypes = ['address', 'coordinates', 'feature', 'user', 'region'];
    if (!validTypes.includes(search_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid search_type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    await pool.query(
      `INSERT INTO search_history (user_id, search_query, search_type, result_count)
       VALUES (?, ?, ?, ?)`,
      [userId, search_query, search_type, result_count || 0]
    );

    res.json({
      success: true,
      message: 'Search added to history'
    });
  } catch (error) {
    console.error('Error adding search to history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add search to history',
      error: error.message
    });
  }
};

/**
 * Clear user's search history
 * DELETE /api/search-history
 */
exports.clearSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM search_history WHERE created_by = ?',
      [userId]
    );

    res.json({
      success: true,
      message: 'Search history cleared'
    });
  } catch (error) {
    console.error('Error clearing search history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear search history',
      error: error.message
    });
  }
};

/**
 * Delete a specific search from history
 * DELETE /api/search-history/:id
 */
exports.deleteSearch = async (req, res) => {
  try {
    const userId = req.user.id;
    const searchId = req.params.id;

    const result = await pool.query(
      'DELETE FROM search_history WHERE id = ? AND user_id = ?',
      [searchId, userId]
    );

    if (result[0].affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Search not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Search deleted from history'
    });
  } catch (error) {
    console.error('Error deleting search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete search',
      error: error.message
    });
  }
};

/**
 * Get search statistics
 * GET /api/search-history/stats
 */
exports.getSearchStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get stats by search type
    const [typeStats] = await pool.query(
      `SELECT search_type, COUNT(*) as count
       FROM search_history
       WHERE created_by = ?
       GROUP BY search_type`,
      [userId]
    );

    // Get total searches
    const [totalResult] = await pool.query(
      'SELECT COUNT(*) as total FROM search_history WHERE created_by = ?',
      [userId]
    );

    // Get most searched queries
    const [topQueries] = await pool.query(
      `SELECT search_query, search_type, COUNT(*) as frequency
       FROM search_history
       WHERE created_by = ?
       GROUP BY search_query, search_type
       ORDER BY frequency DESC
       LIMIT 5`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        total: totalResult[0].total,
        by_type: typeStats,
        top_queries: topQueries
      }
    });
  } catch (error) {
    console.error('Error fetching search stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search statistics',
      error: error.message
    });
  }
};
