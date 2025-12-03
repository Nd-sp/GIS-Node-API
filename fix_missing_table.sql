-- Create missing api_performance_logs table

CREATE TABLE IF NOT EXISTS api_performance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    latency_ms INT NOT NULL,
    status_code INT NOT NULL,
    user_id INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_endpoint (endpoint(255)),
    INDEX idx_user (user_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_status (status_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Table api_performance_logs created successfully!' as Status;
