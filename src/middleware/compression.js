/**
 * Compression Middleware Setup for OptiConnect GIS Platform
 * Reduces response sizes by 70-80% using gzip compression
 *
 * Benefits:
 * - 70-80% smaller response sizes
 * - Faster page loads
 * - Reduced bandwidth usage
 * - Better performance on slow connections
 */

const compression = require('compression');

/**
 * Configure compression middleware
 *
 * Options:
 * - level: Compression level (0-9, higher = more compression but slower)
 * - threshold: Only compress responses larger than this (bytes)
 * - filter: Custom function to determine what to compress
 */
const compressionMiddleware = compression({
  level: 6, // Balanced compression (1=fastest, 9=best compression)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Use compression filter
    return compression.filter(req, res);
  }
});

module.exports = compressionMiddleware;
