-- Migration: Developer Tools
-- Date: 2025-11-27
-- Description: Tables for code analysis reports and developer tools

-- Create dev_tool_reports table
CREATE TABLE IF NOT EXISTS dev_tool_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_type ENUM('frontend', 'fullstack', 'architecture', 'dependency_graph', 'hierarchy') NOT NULL,
  status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
  started_by INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  duration_seconds INT NULL,
  total_files INT NULL,
  total_lines INT NULL,
  unused_files INT NULL,
  high_complexity_files INT NULL,
  report_data_json LONGTEXT NULL,
  report_html_path VARCHAR(500) NULL,
  report_json_path VARCHAR(500) NULL,
  report_md_path VARCHAR(500) NULL,
  error_message TEXT NULL,
  download_count INT DEFAULT 0,
  last_downloaded_at TIMESTAMP NULL,
  FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_report_type (report_type),
  INDEX idx_status (status),
  INDEX idx_started_by (started_by),
  INDEX idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create dev_tool_settings table
CREATE TABLE IF NOT EXISTS dev_tool_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  auto_run_weekly BOOLEAN DEFAULT FALSE,
  send_email_notifications BOOLEAN DEFAULT FALSE,
  preferred_report_format ENUM('html', 'json', 'pdf') DEFAULT 'html',
  show_unused_files BOOLEAN DEFAULT TRUE,
  show_complexity_scores BOOLEAN DEFAULT TRUE,
  max_reports_to_keep INT DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_settings (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default settings for admin user
INSERT IGNORE INTO dev_tool_settings (user_id, auto_run_weekly, send_email_notifications)
VALUES (1, FALSE, FALSE);

-- Grant devtools permissions to admin users (role = admin)
-- Permission IDs are stored as VARCHAR strings
INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by, granted_at)
SELECT u.id, 'devtools.view', 1, NOW()
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM user_permissions up
  WHERE up.user_id = u.id AND up.permission_id = 'devtools.view'
);

INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by, granted_at)
SELECT u.id, 'devtools.run', 1, NOW()
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM user_permissions up
  WHERE up.user_id = u.id AND up.permission_id = 'devtools.run'
);

INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by, granted_at)
SELECT u.id, 'devtools.download', 1, NOW()
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM user_permissions up
  WHERE up.user_id = u.id AND up.permission_id = 'devtools.download'
);

INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by, granted_at)
SELECT u.id, 'devtools.delete', 1, NOW()
FROM users u
WHERE u.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM user_permissions up
  WHERE up.user_id = u.id AND up.permission_id = 'devtools.delete'
);

-- Create dev_security_scans table
CREATE TABLE IF NOT EXISTS dev_security_scans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  scan_type ENUM('full', 'dependencies', 'code', 'config') DEFAULT 'full',
  risk_score INT DEFAULT 0,
  risk_level ENUM('critical', 'high', 'moderate', 'low') DEFAULT 'low',
  vulnerabilities_count INT DEFAULT 0,
  warnings_count INT DEFAULT 0,
  results LONGTEXT NULL,
  scan_duration_ms INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_scan_type (scan_type),
  INDEX idx_risk_level (risk_level),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create dev_backups table
CREATE TABLE IF NOT EXISTS dev_backups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  filename VARCHAR(255) NOT NULL,
  filepath VARCHAR(500) NULL,
  size_bytes BIGINT NOT NULL,
  backup_type ENUM('full', 'partial') DEFAULT 'full',
  tables_count INT DEFAULT 0,
  include_data BOOLEAN DEFAULT TRUE,
  description TEXT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  restored_by INT NULL,
  restored_at TIMESTAMP NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restored_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_backup_type (backup_type),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create dev_env_validations table
CREATE TABLE IF NOT EXISTS dev_env_validations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  environment VARCHAR(50) NOT NULL,
  overall_status ENUM('healthy', 'warning', 'error') DEFAULT 'healthy',
  passed_checks INT DEFAULT 0,
  warning_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  results LONGTEXT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_environment (environment),
  INDEX idx_overall_status (overall_status),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create dev_error_logs table
CREATE TABLE IF NOT EXISTS dev_error_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  error_type VARCHAR(100) NULL,
  error_message TEXT NULL,
  stack_trace LONGTEXT NULL,
  user_id INT NULL,
  request_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_error_type (error_type),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
