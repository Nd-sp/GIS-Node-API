-- Migration: Add props_analysis to report_type ENUM
-- Date: 2025-11-28

USE opticonnectgis_db;

-- Update report_type ENUM to include props_analysis
ALTER TABLE dev_tool_reports
MODIFY COLUMN report_type ENUM(
  'frontend',
  'fullstack',
  'architecture',
  'dependency_graph',
  'hierarchy',
  'props_analysis'
) NOT NULL;

-- Verify the change
SELECT COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='dev_tool_reports'
AND COLUMN_NAME='report_type';
