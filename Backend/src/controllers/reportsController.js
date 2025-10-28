const { pool } = require('../config/database');
const XLSX = require('xlsx');

/**
 * @route   GET /api/reports/region-usage
 * @desc    Get region usage statistics
 * @access  Private (Admin)
 */
const getRegionUsageReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Get region usage statistics from database
    const [stats] = await pool.query(`
      SELECT 
        r.name as region,
        r.code,
        r.type,
        COUNT(DISTINCT ur.user_id) as assigned_users,
        COUNT(DISTINCT ta.user_id) as temp_access_users,
        r.created_at,
        r.updated_at
      FROM regions r
      LEFT JOIN user_regions ur ON r.id = ur.region_id
      LEFT JOIN temporary_access ta ON r.id = ta.resource_id 
        AND ta.resource_type = 'region' 
        AND ta.expires_at > NOW()
        AND ta.revoked_at IS NULL
      WHERE r.is_active = true
      GROUP BY r.id, r.name, r.code, r.type, r.created_at, r.updated_at
      ORDER BY assigned_users DESC, r.name
    `);

    if (format === 'xlsx') {
      return generateXLSX(res, stats, 'region_usage', [
        { header: 'Region', key: 'region' },
        { header: 'Code', key: 'code' },
        { header: 'Type', key: 'type' },
        { header: 'Assigned Users', key: 'assigned_users' },
        { header: 'Temp Access Users', key: 'temp_access_users' },
        { header: 'Created At', key: 'created_at' },
        { header: 'Updated At', key: 'updated_at' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, stats, 'region_usage');
    }

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Region usage report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate region usage report' });
  }
};

/**
 * @route   GET /api/reports/user-activity
 * @desc    Get user activity statistics
 * @access  Private (Admin)
 */
const getUserActivityReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const [activity] = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role,
        u.department,
        COUNT(DISTINCT ur.region_id) as permanent_regions,
        COUNT(DISTINCT ta.id) as temporary_access_grants,
        u.last_login,
        u.created_at
      FROM users u
      LEFT JOIN user_regions ur ON u.id = ur.user_id
      LEFT JOIN temporary_access ta ON u.id = ta.user_id 
        AND ta.expires_at > NOW()
        AND ta.revoked_at IS NULL
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY u.full_name
    `);

    if (format === 'xlsx') {
      return generateXLSX(res, activity, 'user_activity', [
        { header: 'ID', key: 'id' },
        { header: 'Username', key: 'username' },
        { header: 'Full Name', key: 'full_name' },
        { header: 'Email', key: 'email' },
        { header: 'Role', key: 'role' },
        { header: 'Department', key: 'department' },
        { header: 'Permanent Regions', key: 'permanent_regions' },
        { header: 'Temporary Access', key: 'temporary_access_grants' },
        { header: 'Last Login', key: 'last_login' },
        { header: 'Account Created', key: 'created_at' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, activity, 'user_activity');
    }

    res.json({ success: true, data: activity });
  } catch (error) {
    console.error('User activity report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate user activity report' });
  }
};

/**
 * @route   GET /api/reports/access-denials
 * @desc    Get access denial statistics  
 * @access  Private (Admin)
 */
const getAccessDenialsReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Get audit logs for denied accesses
    const [denials] = await pool.query(`
      SELECT 
        al.user_id,
        u.username,
        u.full_name,
        u.email,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action LIKE '%DENIED%' 
        OR al.action LIKE '%FAILED%'
        OR JSON_EXTRACT(al.details, '$.success') = false
      ORDER BY al.created_at DESC
      LIMIT 1000
    `);

    if (format === 'xlsx') {
      return generateXLSX(res, denials, 'access_denials', [
        { header: 'User ID', key: 'user_id' },
        { header: 'Username', key: 'username' },
        { header: 'Full Name', key: 'full_name' },
        { header: 'Email', key: 'email' },
        { header: 'Action', key: 'action' },
        { header: 'Resource Type', key: 'resource_type' },
        { header: 'Resource ID', key: 'resource_id' },
        { header: 'Details', key: 'details' },
        { header: 'Timestamp', key: 'created_at' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, denials, 'access_denials');
    }

    res.json({ success: true, data: denials });
  } catch (error) {
    console.error('Access denials report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate access denials report' });
  }
};

/**
 * @route   GET /api/reports/audit-logs
 * @desc    Get audit logs report
 * @access  Private (Admin)
 */
const getAuditLogsReport = async (req, res) => {
  try {
    const { format = 'json', limit = 1000 } = req.query;

    const [logs] = await pool.query(`
      SELECT 
        al.id,
        al.user_id,
        u.username,
        u.full_name,
        al.action,
        al.resource_type,
        al.resource_id,
        al.details,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    if (format === 'xlsx') {
      return generateXLSX(res, logs, 'audit_logs', [
        { header: 'ID', key: 'id' },
        { header: 'User ID', key: 'user_id' },
        { header: 'Username', key: 'username' },
        { header: 'Full Name', key: 'full_name' },
        { header: 'Action', key: 'action' },
        { header: 'Resource Type', key: 'resource_type' },
        { header: 'Resource ID', key: 'resource_id' },
        { header: 'Details', key: 'details' },
        { header: 'IP Address', key: 'ip_address' },
        { header: 'User Agent', key: 'user_agent' },
        { header: 'Timestamp', key: 'created_at' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, logs, 'audit_logs');
    }

    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Audit logs report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate audit logs report' });
  }
};

/**
 * @route   GET /api/reports/temporary-access
 * @desc    Get temporary access report
 * @access  Private (Admin)
 */
const getTemporaryAccessReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const [tempAccess] = await pool.query(`
      SELECT 
        ta.id,
        ta.user_id,
        u.username,
        u.full_name as user_name,
        u.email as user_email,
        r.name as region,
        ta.granted_by,
        gb.full_name as granted_by_name,
        ta.granted_at,
        ta.expires_at,
        ta.revoked_at,
        ta.revoked_by,
        rb.full_name as revoked_by_name,
        ta.reason,
        CASE 
          WHEN ta.revoked_at IS NOT NULL THEN 'Revoked'
          WHEN ta.expires_at < NOW() THEN 'Expired'
          ELSE 'Active'
        END as status,
        TIMESTAMPDIFF(SECOND, NOW(), ta.expires_at) as seconds_remaining
      FROM temporary_access ta
      INNER JOIN users u ON ta.user_id = u.id
      INNER JOIN regions r ON ta.resource_id = r.id AND ta.resource_type = 'region'
      LEFT JOIN users gb ON ta.granted_by = gb.id
      LEFT JOIN users rb ON ta.revoked_by = rb.id
      ORDER BY ta.granted_at DESC
    `);

    if (format === 'xlsx') {
      return generateXLSX(res, tempAccess, 'temporary_access', [
        { header: 'ID', key: 'id' },
        { header: 'User', key: 'user_name' },
        { header: 'Email', key: 'user_email' },
        { header: 'Region', key: 'region' },
        { header: 'Granted By', key: 'granted_by_name' },
        { header: 'Granted At', key: 'granted_at' },
        { header: 'Expires At', key: 'expires_at' },
        { header: 'Status', key: 'status' },
        { header: 'Revoked At', key: 'revoked_at' },
        { header: 'Revoked By', key: 'revoked_by_name' },
        { header: 'Reason', key: 'reason' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, tempAccess, 'temporary_access');
    }

    res.json({ success: true, data: tempAccess });
  } catch (error) {
    console.error('Temporary access report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate temporary access report' });
  }
};

/**
 * @route   GET /api/reports/region-requests
 * @desc    Get region requests report
 * @access  Private (Admin)
 */
const getRegionRequestsReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const [requests] = await pool.query(`
      SELECT 
        rr.id,
        rr.user_id,
        u.username,
        u.full_name as user_name,
        u.email as user_email,
        u.role as user_role,
        r.name as region,
        rr.request_type,
        rr.reason,
        rr.status,
        rr.created_at,
        rr.reviewed_by,
        rb.full_name as reviewed_by_name,
        rr.reviewed_at,
        rr.review_notes
      FROM region_requests rr
      INNER JOIN users u ON rr.user_id = u.id
      INNER JOIN regions r ON rr.region_id = r.id
      LEFT JOIN users rb ON rr.reviewed_by = rb.id
      ORDER BY rr.created_at DESC
    `);

    if (format === 'xlsx') {
      return generateXLSX(res, requests, 'region_requests', [
        { header: 'ID', key: 'id' },
        { header: 'User', key: 'user_name' },
        { header: 'Email', key: 'user_email' },
        { header: 'Role', key: 'user_role' },
        { header: 'Region', key: 'region' },
        { header: 'Request Type', key: 'request_type' },
        { header: 'Reason', key: 'reason' },
        { header: 'Status', key: 'status' },
        { header: 'Created At', key: 'created_at' },
        { header: 'Reviewed By', key: 'reviewed_by_name' },
        { header: 'Reviewed At', key: 'reviewed_at' },
        { header: 'Review Notes', key: 'review_notes' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, requests, 'region_requests');
    }

    res.json({ success: true, data: requests });
  } catch (error) {
    console.error('Region requests report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate region requests report' });
  }
};

/**
 * @route   GET /api/reports/zone-assignments
 * @desc    Get zone assignments report
 * @access  Private (Admin)
 */
const getZoneAssignmentsReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // For now, return user-region assignments as "zones"
    const [assignments] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        u.full_name as user_name,
        u.email as user_email,
        u.role,
        GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') as assigned_regions,
        COUNT(ur.region_id) as region_count,
        ab.full_name as assigned_by_name,
        MIN(ur.assigned_at) as first_assignment,
        MAX(ur.assigned_at) as latest_assignment
      FROM users u
      LEFT JOIN user_regions ur ON u.id = ur.user_id
      LEFT JOIN regions r ON ur.region_id = r.id
      LEFT JOIN users ab ON ur.assigned_by = ab.id
      WHERE u.is_active = true
      GROUP BY u.id, ab.full_name
      HAVING region_count > 0
      ORDER BY u.full_name
    `);

    if (format === 'xlsx') {
      return generateXLSX(res, assignments, 'zone_assignments', [
        { header: 'User ID', key: 'user_id' },
        { header: 'Username', key: 'username' },
        { header: 'Full Name', key: 'user_name' },
        { header: 'Email', key: 'user_email' },
        { header: 'Role', key: 'role' },
        { header: 'Assigned Regions', key: 'assigned_regions' },
        { header: 'Total Regions', key: 'region_count' },
        { header: 'Assigned By', key: 'assigned_by_name' },
        { header: 'First Assignment', key: 'first_assignment' },
        { header: 'Latest Assignment', key: 'latest_assignment' }
      ]);
    }

    if (format === 'csv') {
      return generateCSV(res, assignments, 'zone_assignments');
    }

    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error('Zone assignments report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate zone assignments report' });
  }
};

/**
 * @route   GET /api/reports/comprehensive
 * @desc    Get comprehensive report (all data)
 * @access  Private (Admin)
 */
const getComprehensiveReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Gather all statistics
    const [regionStats] = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN is_active = true THEN 1 END) as active FROM regions');
    const [userStats] = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN is_active = true THEN 1 END) as active FROM users');
    const [tempAccessStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN expires_at > NOW() AND revoked_at IS NULL THEN 1 END) as active,
        COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked
      FROM temporary_access
    `);
    const [requestStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM region_requests
    `);
    const [auditStats] = await pool.query('SELECT COUNT(*) as total FROM audit_logs');

    const comprehensiveData = {
      generated_at: new Date().toISOString(),
      summary: {
        regions: regionStats[0],
        users: userStats[0],
        temporary_access: tempAccessStats[0],
        region_requests: requestStats[0],
        audit_logs: auditStats[0]
      }
    };

    if (format === 'xlsx') {
      // Create multi-sheet workbook
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['COMPREHENSIVE REGION MANAGEMENT REPORT'],
        ['Generated:', new Date().toISOString()],
        [],
        ['STATISTICS SUMMARY'],
        ['Total Regions:', regionStats[0].total],
        ['Active Regions:', regionStats[0].active],
        ['Total Users:', userStats[0].total],
        ['Active Users:', userStats[0].active],
        ['Total Temporary Access Grants:', tempAccessStats[0].total],
        ['Active Temporary Access:', tempAccessStats[0].active],
        ['Revoked Temporary Access:', tempAccessStats[0].revoked],
        ['Total Region Requests:', requestStats[0].total],
        ['Pending Requests:', requestStats[0].pending],
        ['Approved Requests:', requestStats[0].approved],
        ['Rejected Requests:', requestStats[0].rejected],
        ['Total Audit Log Entries:', auditStats[0].total]
      ];
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');

      // Send file
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Disposition', `attachment; filename="comprehensive_report_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buffer);
    }

    if (format === 'csv') {
      const csvContent = [
        '=== COMPREHENSIVE REGION MANAGEMENT REPORT ===',
        `Generated: ${new Date().toISOString()}`,
        '',
        '=== STATISTICS SUMMARY ===',
        `Total Regions: ${regionStats[0].total}`,
        `Active Regions: ${regionStats[0].active}`,
        `Total Users: ${userStats[0].total}`,
        `Active Users: ${userStats[0].active}`,
        `Total Temporary Access Grants: ${tempAccessStats[0].total}`,
        `Active Temporary Access: ${tempAccessStats[0].active}`,
        `Total Region Requests: ${requestStats[0].total}`,
        `Pending Requests: ${requestStats[0].pending}`,
        `Total Audit Log Entries: ${auditStats[0].total}`,
        ''
      ].join('\n');

      res.setHeader('Content-Disposition', `attachment; filename="comprehensive_report_${new Date().toISOString().split('T')[0]}.csv"`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvContent);
    }

    res.json({ success: true, data: comprehensiveData });
  } catch (error) {
    console.error('Comprehensive report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate comprehensive report' });
  }
};

/**
 * Helper: Generate XLSX file
 */
function generateXLSX(res, data, reportName, columns) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.key) });
  
  // Set column headers
  XLSX.utils.sheet_add_aoa(ws, [columns.map(c => c.header)], { origin: 'A1' });
  
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Disposition', `attachment; filename="${reportName}_${new Date().toISOString().split('T')[0]}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

/**
 * Helper: Generate CSV file
 */
function generateCSV(res, data, reportName) {
  if (data.length === 0) {
    return res.status(404).json({ success: false, error: 'No data available' });
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma or newline
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ];

  res.setHeader('Content-Disposition', `attachment; filename="${reportName}_${new Date().toISOString().split('T')[0]}.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  res.send(csvRows.join('\n'));
}

module.exports = {
  getRegionUsageReport,
  getUserActivityReport,
  getAccessDenialsReport,
  getAuditLogsReport,
  getTemporaryAccessReport,
  getRegionRequestsReport,
  getZoneAssignmentsReport,
  getComprehensiveReport
};
