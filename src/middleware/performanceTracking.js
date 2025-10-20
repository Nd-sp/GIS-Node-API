const { pool } = require('../config/database');

/**
 * Performance Tracking Middleware
 *
 * Tracks API request performance metrics including:
 * - Request latency (response time)
 * - Status codes
 * - Endpoint usage
 * - User activity
 * - Timestamp data for analytics
 */

// In-memory buffer for batch inserts (reduces database load)
let performanceBuffer = [];
const BUFFER_SIZE = 50; // Insert every 50 requests
const BUFFER_TIMEOUT = 30000; // Or every 30 seconds

/**
 * Flush performance logs to database
 */
const flushPerformanceLogs = async () => {
  if (performanceBuffer.length === 0) return;

  const logsToInsert = [...performanceBuffer];
  performanceBuffer = [];

  try {
    const values = logsToInsert.map(log => [
      log.endpoint,
      log.method,
      log.latency,
      log.status,
      log.userId,
      log.timestamp
    ]);

    const query = `
      INSERT INTO api_performance_logs
      (endpoint, method, latency_ms, status_code, user_id, timestamp)
      VALUES ?
    `;

    await pool.query(query, [values]);
  } catch (error) {
    console.error('Error flushing performance logs:', error);
    // Don't throw error - performance tracking should not break the app
  }
};

// Set up periodic flush
setInterval(flushPerformanceLogs, BUFFER_TIMEOUT);

/**
 * Log API call performance
 */
const logApiCall = (data) => {
  performanceBuffer.push({
    endpoint: data.endpoint,
    method: data.method,
    latency: data.latency,
    status: data.status,
    userId: data.userId || null,
    timestamp: data.timestamp
  });

  // Flush if buffer is full
  if (performanceBuffer.length >= BUFFER_SIZE) {
    flushPerformanceLogs();
  }
};

/**
 * Performance tracking middleware
 * Captures request start time, response time, and logs metrics
 */
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Store original send function
  const originalSend = res.send;

  // Override send function to capture response time
  res.send = function (data) {
    const endTime = Date.now();
    const latency = endTime - startTime;

    // Log the API call with performance metrics
    logApiCall({
      endpoint: req.originalUrl,
      method: req.method,
      latency,
      status: res.statusCode,
      timestamp: new Date(),
      userId: req.user?.id // Capture user ID if authenticated
    });

    // Add performance headers to response
    res.setHeader('X-Response-Time', `${latency}ms`);
    res.setHeader('X-Request-ID', req.headers['x-request-id'] || generateRequestId());

    // Call original send function
    originalSend.call(this, data);
  };

  next();
};

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Cleanup function to flush remaining logs on shutdown
 */
const cleanup = async () => {
  console.log('Flushing remaining performance logs...');
  await flushPerformanceLogs();
};

// Handle graceful shutdown
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

module.exports = {
  performanceMiddleware,
  logApiCall,
  flushPerformanceLogs,
  cleanup
};
