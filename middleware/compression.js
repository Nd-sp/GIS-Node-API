/**
 * Compression Middleware Setup for OptiConnect GIS Platform
 * Reduces response sizes by 70-80% using gzip compression
 *
 * Installation:
 * npm install compression
 *
 * Usage in server.js:
 * const compressionSetup = require('./middleware/compression');
 * app.use(compressionSetup);
 *
 * Benefits:
 * - 70-80% smaller response sizes
 * - Faster data transfer
 * - Reduced bandwidth costs
 * - Better user experience
 */

const compression = require('compression');

/**
 * Compression middleware with custom configuration
 */
const compressionSetup = compression({
  // Compression level (0-9)
  // 6 is a good balance between speed and compression ratio
  // Higher = better compression but slower
  level: 6,

  // Only compress responses larger than 1KB
  // Smaller responses aren't worth compressing
  threshold: 1024,

  // Custom filter function
  filter: (req, res) => {
    // Don't compress if client doesn't accept encoding
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress if response has no-transform cache-control
    const cacheControl = res.getHeader('Cache-Control');
    if (cacheControl && cacheControl.includes('no-transform')) {
      return false;
    }

    // Don't compress already compressed formats
    const contentType = res.getHeader('Content-Type');
    if (contentType) {
      const type = contentType.split(';')[0].trim().toLowerCase();

      // Skip compression for already compressed formats
      const skipTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'application/zip',
        'application/x-gzip',
        'application/x-bzip2'
      ];

      if (skipTypes.includes(type)) {
        return false;
      }
    }

    // Use default compression filter for everything else
    return compression.filter(req, res);
  },

  // Memory level (1-9)
  // Higher = more memory but better compression
  memLevel: 8,

  // Compression strategy
  // Z_DEFAULT_STRATEGY (0) is good for most cases
  strategy: 0
});

/**
 * Middleware to add compression headers for debugging
 */
const addCompressionHeaders = (req, res, next) => {
  // Store original send method
  const originalSend = res.send.bind(res);

  // Get original size
  let originalSize = 0;

  res.send = (data) => {
    // Calculate original size
    if (typeof data === 'string') {
      originalSize = Buffer.byteLength(data);
    } else if (Buffer.isBuffer(data)) {
      originalSize = data.length;
    } else if (typeof data === 'object') {
      originalSize = Buffer.byteLength(JSON.stringify(data));
    }

    // Add header with original size
    res.set('X-Original-Size', originalSize.toString());

    // Log compression stats in development
    if (process.env.NODE_ENV === 'development') {
      const compressed = res.getHeader('Content-Encoding') === 'gzip';
      if (compressed && originalSize > 1024) {
        console.log(`📦 Compression: ${(originalSize / 1024).toFixed(2)}KB → ${compressed ? 'compressed' : 'original'}`);
      }
    }

    return originalSend(data);
  };

  next();
};

/**
 * Get compression statistics middleware
 * Add this route: app.get('/api/compression/stats', getCompressionStats);
 */
const getCompressionStats = (req, res) => {
  res.json({
    enabled: true,
    level: 6,
    threshold: '1KB',
    supported: req.acceptsEncodings('gzip'),
    clientAccepts: req.headers['accept-encoding'] || 'none'
  });
};

module.exports = compressionSetup;
module.exports.addCompressionHeaders = addCompressionHeaders;
module.exports.getCompressionStats = getCompressionStats;

/**
 * INTEGRATION EXAMPLE (server.js or app.js):
 *
 * const express = require('express');
 * const compressionSetup = require('./middleware/compression');
 *
 * const app = express();
 *
 * // Add compression middleware BEFORE route handlers
 * app.use(compressionSetup);
 *
 * // Optional: Add compression headers for debugging
 * if (process.env.NODE_ENV === 'development') {
 *   app.use(compressionSetup.addCompressionHeaders);
 * }
 *
 * // Your routes...
 * app.use('/api', routes);
 *
 * // Compression stats endpoint
 * app.get('/api/compression/stats', compressionSetup.getCompressionStats);
 *
 * ===============================================
 * EXPECTED RESULTS:
 * ===============================================
 *
 * Example: Infrastructure API response with 1000 items
 *
 * Before compression:
 * - Response size: 2.5 MB
 * - Transfer time: 5-10 seconds on 3G
 * - Transfer time: 1-2 seconds on 4G/WiFi
 *
 * After compression:
 * - Response size: ~500 KB (80% reduction!)
 * - Transfer time: 1-2 seconds on 3G
 * - Transfer time: 0.2-0.5 seconds on 4G/WiFi
 *
 * Bandwidth saved: 2 MB per request × 1000 requests/day = 2 GB/day!
 *
 * ===============================================
 * VERIFICATION:
 * ===============================================
 *
 * 1. Check response headers in browser DevTools:
 *    Content-Encoding: gzip
 *    X-Original-Size: 2500000
 *
 * 2. Compare sizes in Network tab:
 *    Size: 500 KB
 *    Original: 2.5 MB
 *
 * 3. curl with compression:
 *    curl -H "Accept-Encoding: gzip" https://your-api.com/api/infrastructure --output test.gz
 *    gzip -d test.gz
 *    ls -lh test
 */
