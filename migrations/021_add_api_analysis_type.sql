-- Migration: Add api_analysis to report_type ENUM
-- Date: 2025-11-29

USE opticonnectgis_db;

-- Update report_type ENUM to include api_analysis
ALTER TABLE dev_tool_reports
MODIFY COLUMN report_type ENUM(
  'frontend',
  'fullstack',
  'architecture',
  'dependency_graph',
  'hierarchy',
  'props_analysis',
  'api_analysis'
) NOT NULL;

-- Verify the change
SHOW COLUMNS FROM dev_tool_reports LIKE 'report_type';
