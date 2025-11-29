const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { analyzeProps } = require('../utils/propsAnalyzer');
const { analyzeAPIs } = require('../utils/apiAnalyzer');
const { sendDevToolsNotification } = require('../services/emailService');

// Helper function to send email notifications to admins if enabled
async function sendAdminNotifications(toolType, reportType, status, duration, stats = {}, errorMessage = null) {
  try {
    // Get admin users with email notifications enabled from dev_tool_settings
    const [admins] = await pool.query(`
      SELECT u.id, u.email, u.username, u.full_name, s.send_email_notifications
      FROM users u
      LEFT JOIN dev_tool_settings s ON s.user_id = u.id
      WHERE u.role = 'admin' AND u.email IS NOT NULL
        AND (s.send_email_notifications = 1 OR s.send_email_notifications IS NULL)
    `);

    if (admins.length === 0) {
      console.log('📧 No admin users with email notifications enabled');
      return;
    }

    // Send notifications to all admins
    for (const admin of admins) {
      await sendDevToolsNotification({
        toolType,
        reportType,
        status,
        duration,
        stats,
        errorMessage,
        adminEmail: admin.email,
        adminName: admin.full_name || admin.username
      });
    }

    console.log(`📧 Sent notifications to ${admins.length} admin(s)`);
  } catch (error) {
    console.error('❌ Error sending admin notifications:', error);
    // Don't throw - email failures shouldn't break the analysis
  }
}

// Run code analysis
exports.runAnalysis = async (req, res) => {
  const { analysisType } = req.body; // 'frontend', 'fullstack', 'architecture', 'dependency_graph'
  const userId = req.user.id;

  try {
    // Create report record
    const [result] = await pool.query(
      'INSERT INTO dev_tool_reports (report_type, status, started_by) VALUES (?, ?, ?)',
      [analysisType, 'running', userId]
    );

    const reportId = result.insertId;

    // Run analysis in background
    const analyzerPath = path.join(__dirname, '..', '..', '..', 'code-analyzer');
    let command;

    switch (analysisType) {
      case 'frontend':
        command = 'npm run analyze:frontend:enhanced';
        break;
      case 'fullstack':
        command = 'npm run analyze:fullstack';
        break;
      case 'architecture':
        command = 'npm run analyze:architecture';
        break;
      case 'dependency_graph':
        command = 'npm run analyze:graph';
        break;
      case 'hierarchy':
        command = 'npm run analyze:hierarchy';
        break;
      default:
        throw new Error('Invalid analysis type');
    }

    const startTime = Date.now();

    exec(command, { cwd: analyzerPath }, async (error, stdout, stderr) => {
      const duration = Math.round((Date.now() - startTime) / 1000);

      if (error) {
        await pool.query(
          'UPDATE dev_tool_reports SET status = ?, error_message = ?, completed_at = NOW(), duration_seconds = ? WHERE id = ?',
          ['failed', error.message, duration, reportId]
        );

        // Send email notification
        await sendAdminNotifications('code_analysis', analysisType, 'failed', duration, {}, error.message);

        // Emit WebSocket event
        if (req.app.get('io')) {
          req.app.get('io').to(`user_${userId}`).emit('analysis_failed', {
            reportId,
            analysisType,
            error: error.message
          });
        }
        return;
      }

      // Parse output to get stats
      const stats = parseAnalysisOutput(stdout, analysisType);

      // Determine output paths
      const outputDir = getOutputPath(analysisType);
      const htmlPath = path.join(outputDir, getHtmlFileName(analysisType));
      const jsonPath = path.join(outputDir, getJsonFileName(analysisType));

      // Update report record
      await pool.query(
        `UPDATE dev_tool_reports
         SET status = ?, completed_at = NOW(), duration_seconds = ?,
             total_files = ?, total_lines = ?, unused_files = ?,
             high_complexity_files = ?, report_html_path = ?, report_json_path = ?
         WHERE id = ?`,
        [
          'completed',
          duration,
          stats.totalFiles,
          stats.totalLines,
          stats.unusedFiles,
          stats.highComplexityFiles,
          htmlPath,
          jsonPath,
          reportId
        ]
      );

      // Send email notification
      await sendAdminNotifications('code_analysis', analysisType, 'completed', duration, {
        total_files: stats.totalFiles,
        unused_files: stats.unusedFiles,
        total_lines: stats.totalLines
      });

      // Emit WebSocket event
      if (req.app.get('io')) {
        req.app.get('io').to(`user_${userId}`).emit('analysis_completed', {
          reportId,
          analysisType,
          duration,
          stats
        });
      }
    });

    res.json({
      success: true,
      reportId,
      message: 'Analysis started',
      estimatedTime: getEstimatedTime(analysisType)
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get analysis status
exports.getAnalysisStatus = async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;

  try {
    const [reports] = await pool.query(
      `SELECT r.*, u.username as started_by_name
       FROM dev_tool_reports r
       LEFT JOIN users u ON r.started_by = u.id
       WHERE r.id = ? AND r.started_by = ?`,
      [reportId, userId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report: reports[0] });
  } catch (error) {
    console.error('Error fetching report status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all reports
exports.getAllReports = async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const allReports = [];

    // 1. Fetch Code Analysis Reports (dev_tool_reports)
    const codeReportsQuery = isAdmin
      ? `SELECT r.id, r.report_type, r.status, r.started_by, u.username as started_by_name,
                r.started_at, r.completed_at, r.duration_seconds, r.total_files, r.total_lines,
                r.unused_files, r.high_complexity_files, r.error_message, r.download_count,
                'code_analysis' as category
         FROM dev_tool_reports r
         LEFT JOIN users u ON r.started_by = u.id
         ORDER BY r.started_at DESC LIMIT 50`
      : `SELECT r.id, r.report_type, r.status, r.started_by, u.username as started_by_name,
                r.started_at, r.completed_at, r.duration_seconds, r.total_files, r.total_lines,
                r.unused_files, r.high_complexity_files, r.error_message, r.download_count,
                'code_analysis' as category
         FROM dev_tool_reports r
         LEFT JOIN users u ON r.started_by = u.id
         WHERE r.started_by = ?
         ORDER BY r.started_at DESC LIMIT 50`;

    const [codeReports] = await pool.query(codeReportsQuery, isAdmin ? [] : [userId]);
    allReports.push(...codeReports);

    // 2. Fetch Security Scans (dev_security_scans)
    const securityQuery = isAdmin
      ? `SELECT s.id, s.scan_type as report_type,
                CASE WHEN s.id IS NOT NULL THEN 'completed' ELSE 'pending' END as status,
                s.created_by as started_by, u.username as started_by_name,
                s.created_at as started_at, s.created_at as completed_at,
                (s.scan_duration_ms / 1000) as duration_seconds,
                s.vulnerabilities_count as total_files, s.warnings_count as total_lines,
                NULL as unused_files, NULL as high_complexity_files,
                NULL as error_message, 0 as download_count,
                'security_scan' as category
         FROM dev_security_scans s
         LEFT JOIN users u ON s.created_by = u.id
         ORDER BY s.created_at DESC LIMIT 50`
      : `SELECT s.id, s.scan_type as report_type,
                'completed' as status,
                s.created_by as started_by, u.username as started_by_name,
                s.created_at as started_at, s.created_at as completed_at,
                (s.scan_duration_ms / 1000) as duration_seconds,
                s.vulnerabilities_count as total_files, s.warnings_count as total_lines,
                NULL as unused_files, NULL as high_complexity_files,
                NULL as error_message, 0 as download_count,
                'security_scan' as category
         FROM dev_security_scans s
         LEFT JOIN users u ON s.created_by = u.id
         WHERE s.created_by = ?
         ORDER BY s.created_at DESC LIMIT 50`;

    const [securityScans] = await pool.query(securityQuery, isAdmin ? [] : [userId]);
    allReports.push(...securityScans);

    // 3. Fetch Database Backups (dev_backups)
    const backupsQuery = isAdmin
      ? `SELECT b.id, 'database_backup' as report_type,
                CASE WHEN b.restored_at IS NOT NULL THEN 'completed' ELSE 'completed' END as status,
                b.created_by as started_by, u.username as started_by_name,
                b.created_at as started_at, b.created_at as completed_at,
                NULL as duration_seconds,
                b.tables_count as total_files, b.size_bytes as total_lines,
                NULL as unused_files, NULL as high_complexity_files,
                NULL as error_message, 0 as download_count,
                'database_backup' as category
         FROM dev_backups b
         LEFT JOIN users u ON b.created_by = u.id
         ORDER BY b.created_at DESC LIMIT 50`
      : `SELECT b.id, 'database_backup' as report_type,
                'completed' as status,
                b.created_by as started_by, u.username as started_by_name,
                b.created_at as started_at, b.created_at as completed_at,
                NULL as duration_seconds,
                b.tables_count as total_files, b.size_bytes as total_lines,
                NULL as unused_files, NULL as high_complexity_files,
                NULL as error_message, 0 as download_count,
                'database_backup' as category
         FROM dev_backups b
         LEFT JOIN users u ON b.created_by = u.id
         WHERE b.created_by = ?
         ORDER BY b.created_at DESC LIMIT 50`;

    const [backups] = await pool.query(backupsQuery, isAdmin ? [] : [userId]);
    allReports.push(...backups);

    // 4. Fetch Environment Validations (dev_env_validations)
    const envQuery = isAdmin
      ? `SELECT e.id, 'env_validation' as report_type,
                CASE WHEN e.overall_status = 'healthy' THEN 'completed'
                     WHEN e.overall_status = 'error' THEN 'failed'
                     ELSE 'completed' END as status,
                e.created_by as started_by, u.username as started_by_name,
                e.created_at as started_at, e.created_at as completed_at,
                NULL as duration_seconds,
                e.passed_checks as total_files, e.warning_count as total_lines,
                e.error_count as unused_files, NULL as high_complexity_files,
                NULL as error_message, 0 as download_count,
                'env_validation' as category
         FROM dev_env_validations e
         LEFT JOIN users u ON e.created_by = u.id
         ORDER BY e.created_at DESC LIMIT 50`
      : `SELECT e.id, 'env_validation' as report_type,
                CASE WHEN e.overall_status = 'healthy' THEN 'completed'
                     WHEN e.overall_status = 'error' THEN 'failed'
                     ELSE 'completed' END as status,
                e.created_by as started_by, u.username as started_by_name,
                e.created_at as started_at, e.created_at as completed_at,
                NULL as duration_seconds,
                e.passed_checks as total_files, e.warning_count as total_lines,
                e.error_count as unused_files, NULL as high_complexity_files,
                NULL as error_message, 0 as download_count,
                'env_validation' as category
         FROM dev_env_validations e
         LEFT JOIN users u ON e.created_by = u.id
         WHERE e.created_by = ?
         ORDER BY e.created_at DESC LIMIT 50`;

    const [envValidations] = await pool.query(envQuery, isAdmin ? [] : [userId]);
    allReports.push(...envValidations);

    // Sort all reports by started_at DESC
    allReports.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

    // Limit to 100 total reports
    const limitedReports = allReports.slice(0, 100);

    res.json({ success: true, reports: limitedReports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Download report
exports.downloadReport = async (req, res) => {
  const { reportId } = req.params;
  const { format } = req.query; // 'html', 'json', or 'md'

  try {
    const [reports] = await pool.query(
      'SELECT * FROM dev_tool_reports WHERE id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = reports[0];
    let filePath;
    if (format === 'json') {
      filePath = report.report_json_path;
    } else if (format === 'md') {
      // Generate MD path from report type if not in database
      const outputDir = getOutputPath(report.report_type);
      const mdFileName = getMdFileName(report.report_type);
      filePath = path.join(outputDir, mdFileName);
    } else {
      filePath = report.report_html_path;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Report file not found' });
    }

    // Update download count
    await pool.query(
      'UPDATE dev_tool_reports SET download_count = download_count + 1, last_downloaded_at = NOW() WHERE id = ?',
      [reportId]
    );

    // Send file
    res.download(filePath, path.basename(filePath));
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete report
exports.deleteReport = async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const [reports] = await pool.query(
      'SELECT * FROM dev_tool_reports WHERE id = ?',
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = reports[0];

    // Check permission
    if (!isAdmin && report.started_by !== userId) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    // Delete files
    if (report.report_html_path && fs.existsSync(report.report_html_path)) {
      fs.unlinkSync(report.report_html_path);
    }
    if (report.report_json_path && fs.existsSync(report.report_json_path)) {
      fs.unlinkSync(report.report_json_path);
    }

    // Delete database record
    await pool.query('DELETE FROM dev_tool_reports WHERE id = ?', [reportId]);

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user settings
exports.getUserSettings = async (req, res) => {
  const userId = req.user.id;

  try {
    const [settings] = await pool.query(
      'SELECT * FROM dev_tool_settings WHERE user_id = ?',
      [userId]
    );

    if (settings.length === 0) {
      // Create default settings
      await pool.query(
        'INSERT INTO dev_tool_settings (user_id) VALUES (?)',
        [userId]
      );

      return res.json({
        success: true,
        settings: {
          auto_run_weekly: false,
          send_email_notifications: false,
          preferred_report_format: 'html',
          show_unused_files: true,
          show_complexity_scores: true,
          max_reports_to_keep: 10
        }
      });
    }

    res.json({ success: true, settings: settings[0] });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update user settings
exports.updateUserSettings = async (req, res) => {
  const userId = req.user.id;
  const settings = req.body;

  try {
    await pool.query(
      `UPDATE dev_tool_settings
       SET auto_run_weekly = ?, send_email_notifications = ?,
           preferred_report_format = ?, show_unused_files = ?,
           show_complexity_scores = ?, max_reports_to_keep = ?
       WHERE user_id = ?`,
      [
        settings.auto_run_weekly,
        settings.send_email_notifications,
        settings.preferred_report_format,
        settings.show_unused_files,
        settings.show_complexity_scores,
        settings.max_reports_to_keep,
        userId
      ]
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Run Props Analysis
exports.runPropsAnalysis = async (req, res) => {
  const userId = req.user.id;

  try {
    // Create report record
    const [result] = await pool.query(
      'INSERT INTO dev_tool_reports (report_type, status, started_by) VALUES (?, ?, ?)',
      ['props_analysis', 'running', userId]
    );

    const reportId = result.insertId;

    // Run analysis asynchronously
    const frontendPath = path.join(__dirname, '..', '..', '..', 'Frontend', 'src');

    // Run analysis in background
    (async () => {
      const startTime = Date.now();

      try {
        const analysisResult = await analyzeProps(frontendPath);
        const duration = Math.round((Date.now() - startTime) / 1000);

        // Store result as JSON
        const resultData = JSON.stringify(analysisResult);

        // Update report record
        await pool.query(
          `UPDATE dev_tool_reports
           SET status = ?, report_data_json = ?, completed_at = NOW(), duration_seconds = ?,
               total_files = ?, total_lines = ?
           WHERE id = ?`,
          [
            'completed',
            resultData,
            duration,
            analysisResult.summary.totalComponents,
            analysisResult.summary.totalPropsCount,
            reportId
          ]
        );

        // Send email notification
        await sendAdminNotifications('code_analysis', 'props_analysis', 'completed', duration, {
          total_components: analysisResult.summary.totalComponents,
          total_props: analysisResult.summary.totalPropsCount,
          components_with_props: analysisResult.summary.componentsWithProps
        });

        // Emit WebSocket event
        if (req.app.get('io')) {
          req.app.get('io').to(`user_${userId}`).emit('analysis_completed', {
            reportId,
            analysisType: 'props_analysis',
            duration,
            summary: analysisResult.summary
          });
        }
      } catch (error) {
        console.error('Props analysis error:', error);
        await pool.query(
          'UPDATE dev_tool_reports SET status = ?, error_message = ?, completed_at = NOW() WHERE id = ?',
          ['failed', error.message, reportId]
        );

        // Send email notification
        await sendAdminNotifications('code_analysis', 'props_analysis', 'failed', null, {}, error.message);

        // Emit WebSocket event
        if (req.app.get('io')) {
          req.app.get('io').to(`user_${userId}`).emit('analysis_failed', {
            reportId,
            analysisType: 'props_analysis',
            error: error.message
          });
        }
      }
    })();

    res.json({
      success: true,
      reportId,
      message: 'Props analysis started',
      estimatedTime: '10-30 seconds'
    });
  } catch (error) {
    console.error('Error starting props analysis:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Props Analysis Result
exports.getPropsAnalysisResult = async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const query = isAdmin
      ? 'SELECT * FROM dev_tool_reports WHERE id = ? AND report_type = ?'
      : 'SELECT * FROM dev_tool_reports WHERE id = ? AND report_type = ? AND started_by = ?';

    const params = isAdmin ? [reportId, 'props_analysis'] : [reportId, 'props_analysis', userId];
    const [reports] = await pool.query(query, params);

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = reports[0];

    // Parse report_data_json
    let resultData = null;
    if (report.report_data_json) {
      try {
        resultData = JSON.parse(report.report_data_json);
      } catch (error) {
        console.error('Error parsing result data:', error);
      }
    }

    res.json({
      success: true,
      report: {
        id: report.id,
        status: report.status,
        started_at: report.started_at,
        completed_at: report.completed_at,
        duration_seconds: report.duration_seconds,
        error_message: report.error_message
      },
      data: resultData
    });
  } catch (error) {
    console.error('Error fetching props analysis result:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper functions
function parseAnalysisOutput(stdout, analysisType) {
  const stats = {
    totalFiles: 0,
    totalLines: 0,
    unusedFiles: 0,
    highComplexityFiles: 0
  };

  try {
    const match = stdout.match(/Found (\d+) files/);
    if (match) stats.totalFiles = parseInt(match[1]);

    const unusedMatch = stdout.match(/Found (\d+) unused files/);
    if (unusedMatch) stats.unusedFiles = parseInt(unusedMatch[1]);
  } catch (error) {
    console.error('Error parsing output:', error);
  }

  return stats;
}

function getOutputPath(analysisType) {
  const baseDir = path.join(__dirname, '..', '..', '..', 'code-analyzer', 'output');

  switch (analysisType) {
    case 'frontend':
      return path.join(baseDir, 'frontend-hierarchy');
    case 'fullstack':
      return path.join(baseDir, 'fullstack-dependencies');
    case 'architecture':
      return path.join(baseDir, 'architecture-docs');
    case 'dependency_graph':
      return path.join(baseDir, 'dependency-graph');
    case 'hierarchy':
      return path.join(baseDir, 'component-hierarchy');
    default:
      return baseDir;
  }
}

function getHtmlFileName(analysisType) {
  switch (analysisType) {
    case 'frontend':
      return 'frontend-analysis-enhanced.html';
    case 'fullstack':
      return 'fullstack-analysis.html';
    case 'architecture':
      return 'architecture.html';
    case 'dependency_graph':
      return 'dependency-graph.html';
    case 'hierarchy':
      return 'component-hierarchy.html';
    default:
      return 'report.html';
  }
}

function getJsonFileName(analysisType) {
  switch (analysisType) {
    case 'frontend':
      return 'frontend-analysis-enhanced.json';
    case 'fullstack':
      return 'fullstack-analysis.json';
    case 'architecture':
      return 'architecture.json';
    case 'dependency_graph':
      return 'dependency-graph.json';
    case 'hierarchy':
      return 'component-hierarchy.json';
    default:
      return 'report.json';
  }
}

function getMdFileName(analysisType) {
  switch (analysisType) {
    case 'frontend':
      return 'frontend-analysis-enhanced.md';
    case 'fullstack':
      return 'fullstack-analysis.md';
    case 'architecture':
      return 'architecture.md';
    case 'dependency_graph':
      return 'dependency-graph.md';
    case 'hierarchy':
      return 'component-hierarchy.md';
    default:
      return 'report.md';
  }
}

function getEstimatedTime(analysisType) {
  switch (analysisType) {
    case 'frontend':
      return '20 seconds';
    case 'fullstack':
      return '40 seconds';
    case 'architecture':
      return '15 seconds';
    case 'dependency_graph':
      return '10 seconds';
    case 'hierarchy':
      return '15 seconds';
    default:
      return '30 seconds';
  }
}

// Run API Performance Analysis
exports.runAPIAnalysis = async (req, res) => {
  const userId = req.user.id;

  try {
    // Create report record
    const [result] = await pool.query(
      'INSERT INTO dev_tool_reports (report_type, status, started_by) VALUES (?, ?, ?)',
      ['api_analysis', 'running', userId]
    );

    const reportId = result.insertId;

    // Run analysis asynchronously
    const backendPath = path.join(__dirname, '..', '..');
    const frontendPath = path.join(__dirname, '..', '..', '..', 'Frontend');

    // Run analysis in background
    (async () => {
      const startTime = Date.now();

      try {
        const analysisResult = await analyzeAPIs(backendPath, frontendPath);
        const duration = Math.round((Date.now() - startTime) / 1000);

        // Store result as JSON
        const resultData = JSON.stringify(analysisResult);

        // Update report record
        await pool.query(
          `UPDATE dev_tool_reports
           SET status = ?, report_data_json = ?, completed_at = NOW(), duration_seconds = ?,
               total_files = ?, total_lines = ?
           WHERE id = ?`,
          [
            'completed',
            resultData,
            duration,
            analysisResult.summary.totalEndpoints,
            analysisResult.summary.totalBackendRoutes,
            reportId
          ]
        );

        // Send email notification
        await sendAdminNotifications('code_analysis', 'api_analysis', 'completed', duration, {
          total_endpoints: analysisResult.summary.totalEndpoints,
          mapped_endpoints: analysisResult.summary.mappedEndpoints,
          unused_routes: analysisResult.summary.unmappedRoutes
        });

        // Emit WebSocket event
        if (req.app.get('io')) {
          req.app.get('io').to(`user_${userId}`).emit('analysis_completed', {
            reportId,
            analysisType: 'api_analysis',
            duration,
            summary: analysisResult.summary
          });
        }
      } catch (error) {
        console.error('API analysis error:', error);
        await pool.query(
          'UPDATE dev_tool_reports SET status = ?, error_message = ?, completed_at = NOW() WHERE id = ?',
          ['failed', error.message, reportId]
        );

        // Send email notification
        await sendAdminNotifications('code_analysis', 'api_analysis', 'failed', null, {}, error.message);

        // Emit WebSocket event
        if (req.app.get('io')) {
          req.app.get('io').to(`user_${userId}`).emit('analysis_failed', {
            reportId,
            analysisType: 'api_analysis',
            error: error.message
          });
        }
      }
    })();

    res.json({
      success: true,
      reportId,
      message: 'API analysis started',
      estimatedTime: '10-20 seconds'
    });
  } catch (error) {
    console.error('Error starting API analysis:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get API Analysis Result
exports.getAPIAnalysisResult = async (req, res) => {
  const { reportId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const query = isAdmin
      ? 'SELECT * FROM dev_tool_reports WHERE id = ? AND report_type = ?'
      : 'SELECT * FROM dev_tool_reports WHERE id = ? AND report_type = ? AND started_by = ?';

    const params = isAdmin ? [reportId, 'api_analysis'] : [reportId, 'api_analysis', userId];
    const [reports] = await pool.query(query, params);

    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = reports[0];

    // Parse report_data_json
    let resultData = null;
    if (report.report_data_json) {
      try {
        resultData = JSON.parse(report.report_data_json);
      } catch (error) {
        console.error('Error parsing result data:', error);
      }
    }

    res.json({
      success: true,
      report: {
        id: report.id,
        status: report.status,
        started_at: report.started_at,
        completed_at: report.completed_at,
        duration_seconds: report.duration_seconds,
        error_message: report.error_message
      },
      data: resultData
    });
  } catch (error) {
    console.error('Error fetching API analysis result:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
