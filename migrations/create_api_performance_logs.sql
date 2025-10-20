-- Create API Performance Logs Table
-- This table tracks all API requests for analytics and monitoring

CREATE TABLE IF NOT EXISTS api_performance_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  latency_ms INT NOT NULL,
  status_code INT NOT NULL,
  user_id INT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp),
  INDEX idx_endpoint (endpoint(255)),
  INDEX idx_user_id (user_id),
  INDEX idx_status_code (status_code),
  INDEX idx_composite (timestamp, endpoint(100), user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for common query patterns
CREATE INDEX idx_endpoint_time ON api_performance_logs(endpoint(100), timestamp);
CREATE INDEX idx_user_time ON api_performance_logs(user_id, timestamp);

-- Add comment
ALTER TABLE api_performance_logs COMMENT = 'Stores API performance metrics for analytics and monitoring';
