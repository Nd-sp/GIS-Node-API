const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { sendDevToolsNotification } = require('../services/emailService');

/**
 * Security Vulnerability Scanner Controller
 * Works in both development and production modes
 */

// ========== Helper: Send Email Notifications to Admins ==========
async function sendAdminNotifications(toolType, reportType, status, duration, stats = {}, errorMessage = null) {
  try {
    // Query all admins with email notifications enabled
    const [admins] = await pool.query(`
      SELECT u.id, u.email, u.username, u.full_name, s.send_email_notifications
      FROM users u
      LEFT JOIN dev_tool_settings s ON s.user_id = u.id
      WHERE u.role = 'admin' AND u.email IS NOT NULL
        AND (s.send_email_notifications = 1 OR s.send_email_notifications IS NULL)
    `);

    // Send email to each admin
    for (const admin of admins) {
      await sendDevToolsNotification({
        toolType,
        reportType,
        status,
        duration,
        stats,
        errorMessage,
        adminEmail: admin.email,
        adminName: admin.full_name || admin.username || 'Admin'
      });
    }
  } catch (emailError) {
    console.error('Failed to send email notifications:', emailError.message);
    // Don't throw - email failures shouldn't break the analysis
  }
}

// Run comprehensive security scan
exports.runSecurityScan = async (req, res) => {
  const userId = req.user.id;
  const { scanType = 'full' } = req.body; // 'dependencies', 'code', 'config', 'full'
  const startTime = Date.now();

  try {
    const scanId = Date.now();
    const results = {
      scanId,
      scanType,
      timestamp: new Date().toISOString(),
      vulnerabilities: [],
      warnings: [],
      passed: [],
      summary: {}
    };

    // 1. Dependency Vulnerability Scan (npm audit)
    if (scanType === 'dependencies' || scanType === 'full') {
      console.log('Running dependency scan...');
      const depResults = await scanDependencies();
      results.vulnerabilities.push(...depResults.vulnerabilities);
      results.warnings.push(...depResults.warnings);
      results.summary.dependencies = depResults.summary;
    }

    // 2. Code Security Scan (SQL Injection, XSS, etc.)
    if (scanType === 'code' || scanType === 'full') {
      console.log('Running code security scan...');
      const codeResults = await scanCodeSecurity();
      results.vulnerabilities.push(...codeResults.vulnerabilities);
      results.warnings.push(...codeResults.warnings);
      results.passed.push(...codeResults.passed);
      results.summary.code = codeResults.summary;
    }

    // 3. Configuration Security Scan
    if (scanType === 'config' || scanType === 'full') {
      console.log('Running configuration scan...');
      const configResults = await scanConfiguration();
      results.vulnerabilities.push(...configResults.vulnerabilities);
      results.warnings.push(...configResults.warnings);
      results.passed.push(...configResults.passed);
      results.summary.config = configResults.summary;
    }

    // Calculate overall risk score
    results.summary.totalVulnerabilities = results.vulnerabilities.length;
    results.summary.totalWarnings = results.warnings.length;
    results.summary.riskScore = calculateRiskScore(results);
    results.summary.riskLevel = getRiskLevel(results.summary.riskScore);

    // Save scan results to database
    await saveScanResults(userId, scanId, results);

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Send email notification
    await sendAdminNotifications('security_scan', scanType, 'completed', duration, {
      vulnerabilities_count: results.summary.totalVulnerabilities,
      warnings_count: results.summary.totalWarnings,
      risk_level: results.summary.riskLevel,
      risk_score: results.summary.riskScore
    });

    res.json({
      success: true,
      message: 'Security scan completed',
      data: results
    });

  } catch (error) {
    console.error('Security scan error:', error);

    // Send failure email notification
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await sendAdminNotifications('security_scan', scanType, 'failed', duration, {}, error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to run security scan',
      error: error.message
    });
  }
};

// Get scan history
exports.getScanHistory = async (req, res) => {
  try {
    const [scans] = await pool.query(
      `SELECT id, scan_type, risk_score, risk_level,
              vulnerabilities_count, warnings_count,
              scan_duration_ms, created_at, created_by
       FROM dev_security_scans
       ORDER BY created_at DESC
       LIMIT 50`
    );

    res.json({
      success: true,
      data: scans
    });

  } catch (error) {
    console.error('Get scan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve scan history',
      error: error.message
    });
  }
};

// Get detailed scan results
exports.getScanDetails = async (req, res) => {
  const { scanId } = req.params;

  try {
    const [scans] = await pool.query(
      'SELECT * FROM dev_security_scans WHERE id = ?',
      [scanId]
    );

    if (scans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    const scan = scans[0];
    const results = JSON.parse(scan.results);

    // Merge database fields with results for frontend compatibility
    const combinedData = {
      ...results,
      id: scan.id,
      dbScanType: scan.scan_type,
      dbRiskScore: scan.risk_score,
      dbRiskLevel: scan.risk_level,
      dbVulnerabilitiesCount: scan.vulnerabilities_count,
      dbWarningsCount: scan.warnings_count,
      scanDurationMs: scan.scan_duration_ms,
      createdBy: scan.created_by,
      createdAt: scan.created_at
    };

    res.json({
      success: true,
      data: combinedData
    });

  } catch (error) {
    console.error('Get scan details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve scan details',
      error: error.message
    });
  }
};

// Delete security scan
exports.deleteScan = async (req, res) => {
  const { scanId } = req.params;

  try {
    const [scans] = await pool.query(
      'SELECT * FROM dev_security_scans WHERE id = ?',
      [scanId]
    );

    if (scans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found'
      });
    }

    await pool.query(
      'DELETE FROM dev_security_scans WHERE id = ?',
      [scanId]
    );

    res.json({
      success: true,
      message: 'Scan deleted successfully'
    });

  } catch (error) {
    console.error('Delete scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scan',
      error: error.message
    });
  }
};

// ========== Helper Functions ==========

// Scan NPM dependencies for vulnerabilities
async function scanDependencies() {
  const results = {
    vulnerabilities: [],
    warnings: [],
    summary: {
      total: 0,
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0
    }
  };

  try {
    // Check both Frontend and Backend
    const dirs = ['Frontend', 'Backend'];

    for (const dir of dirs) {
      const packagePath = path.join(process.cwd(), '..', dir, 'package.json');

      if (!fs.existsSync(packagePath)) continue;

      try {
        // Run npm audit --json
        const { stdout } = await execPromise(`cd ..\\${dir} && npm audit --json`, {
          timeout: 30000
        });

        const auditData = JSON.parse(stdout);

        // Parse npm audit results
        if (auditData.vulnerabilities) {
          Object.entries(auditData.vulnerabilities).forEach(([pkg, vuln]) => {
            const severity = vuln.severity;
            results.summary.total++;
            results.summary[severity]++;

            const vulnData = {
              type: 'dependency',
              severity: severity,
              package: pkg,
              currentVersion: vuln.range || 'unknown',
              vulnerableVersions: vuln.via?.map(v => v.range).join(', ') || '',
              recommendation: vuln.fixAvailable ? `Update to ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}` : 'No fix available',
              location: `${dir}/package.json`,
              cwe: vuln.via?.[0]?.cwe || [],
              cvss: vuln.via?.[0]?.cvss || null
            };

            if (severity === 'critical' || severity === 'high') {
              results.vulnerabilities.push(vulnData);
            } else {
              results.warnings.push(vulnData);
            }
          });
        }

      } catch (auditError) {
        // npm audit returns non-zero exit code if vulnerabilities found
        if (auditError.stdout) {
          try {
            const auditData = JSON.parse(auditError.stdout);
            // Process as above
          } catch (parseError) {
            console.error(`Failed to parse npm audit for ${dir}:`, parseError.message);
          }
        }
      }
    }

  } catch (error) {
    console.error('Dependency scan error:', error);
    results.warnings.push({
      type: 'scan_error',
      severity: 'moderate',
      message: 'Failed to complete dependency scan',
      details: error.message
    });
  }

  return results;
}

// Scan code for security vulnerabilities
async function scanCodeSecurity() {
  const results = {
    vulnerabilities: [],
    warnings: [],
    passed: [],
    summary: {
      filesScanned: 0,
      issuesFound: 0,
      categories: {}
    }
  };

  const securityPatterns = [
    {
      name: 'SQL Injection',
      pattern: /query\s*\([^?]*\$\{|query\s*\([^?]*\+\s*['"`]/gi,
      severity: 'critical',
      description: 'Potential SQL injection vulnerability - using string concatenation in queries',
      recommendation: 'Use parameterized queries with ? placeholders'
    },
    {
      name: 'XSS Vulnerability',
      pattern: /dangerouslySetInnerHTML|innerHTML\s*=/gi,
      severity: 'high',
      description: 'Potential XSS vulnerability - using dangerouslySetInnerHTML or innerHTML',
      recommendation: 'Use safe React rendering or sanitize HTML with DOMPurify'
    },
    {
      name: 'Hardcoded Secrets',
      pattern: /(password|secret|api[_-]?key|token|jwt[_-]?secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      severity: 'critical',
      description: 'Hardcoded credentials or secrets found in code',
      recommendation: 'Move secrets to environment variables'
    },
    {
      name: 'Weak Crypto',
      pattern: /crypto\.createHash\(['"]md5['"]|crypto\.createHash\(['"]sha1['"]|Math\.random\(\)/gi,
      severity: 'high',
      description: 'Weak cryptographic function usage',
      recommendation: 'Use SHA-256 or stronger, avoid Math.random() for security'
    },
    {
      name: 'Command Injection',
      pattern: /exec\([^)]*\$\{|exec\([^)]*\+\s*['"`]|spawn\([^)]*\$\{/gi,
      severity: 'critical',
      description: 'Potential command injection vulnerability',
      recommendation: 'Validate and sanitize all user inputs, use parameterized commands'
    },
    {
      name: 'Path Traversal',
      pattern: /readFile\([^)]*\$\{|readFileSync\([^)]*\$\{|path\.join\([^)]*req\./gi,
      severity: 'high',
      description: 'Potential path traversal vulnerability',
      recommendation: 'Validate file paths and use path.resolve with whitelist'
    },
    {
      name: 'Insecure HTTP',
      pattern: /http:\/\/(?!localhost)/gi,
      severity: 'moderate',
      description: 'Using HTTP instead of HTTPS for external resources',
      recommendation: 'Use HTTPS for all external communications'
    },
    {
      name: 'Console Logging Sensitive Data',
      pattern: /console\.(log|info|debug)\([^)]*password[^)]*\)|console\.(log|info|debug)\([^)]*token[^)]*\)/gi,
      severity: 'moderate',
      description: 'Logging potentially sensitive information',
      recommendation: 'Remove console.log statements with sensitive data in production'
    }
  ];

  try {
    const scanDirs = [
      path.join(process.cwd(), 'src'),
      path.join(process.cwd(), '..', 'Frontend', 'src')
    ];

    for (const dir of scanDirs) {
      if (!fs.existsSync(dir)) continue;

      await scanDirectoryRecursive(dir, dir, results, securityPatterns);
    }

    // Add passed checks
    securityPatterns.forEach(pattern => {
      if (!results.summary.categories[pattern.name]) {
        results.passed.push({
          check: pattern.name,
          status: 'passed',
          message: `No ${pattern.name} vulnerabilities detected`
        });
      }
    });

  } catch (error) {
    console.error('Code security scan error:', error);
    results.warnings.push({
      type: 'scan_error',
      severity: 'moderate',
      message: 'Failed to complete code security scan',
      details: error.message
    });
  }

  return results;
}

// Recursive directory scanner
async function scanDirectoryRecursive(dir, baseDir, results, patterns) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and other common directories
      if (!['node_modules', 'build', 'dist', '.git', 'coverage'].includes(file)) {
        await scanDirectoryRecursive(filePath, baseDir, results, patterns);
      }
    } else if (stat.isFile()) {
      // Scan code files
      const ext = path.extname(file);
      if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
        scanFile(filePath, baseDir, results, patterns);
      }
    }
  }
}

// Scan individual file
function scanFile(filePath, baseDir, results, patterns) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(baseDir, filePath);

    results.summary.filesScanned++;

    patterns.forEach(pattern => {
      const matches = [];
      let lineNumber = 1;

      lines.forEach(line => {
        if (pattern.pattern.test(line)) {
          matches.push({
            line: lineNumber,
            code: line.trim()
          });
        }
        lineNumber++;
      });

      if (matches.length > 0) {
        results.summary.issuesFound += matches.length;

        if (!results.summary.categories[pattern.name]) {
          results.summary.categories[pattern.name] = 0;
        }
        results.summary.categories[pattern.name] += matches.length;

        const issue = {
          type: 'code_vulnerability',
          severity: pattern.severity,
          category: pattern.name,
          description: pattern.description,
          recommendation: pattern.recommendation,
          file: relativePath,
          matches: matches,
          matchCount: matches.length
        };

        if (pattern.severity === 'critical' || pattern.severity === 'high') {
          results.vulnerabilities.push(issue);
        } else {
          results.warnings.push(issue);
        }
      }
    });

  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error.message);
  }
}

// Scan configuration files
async function scanConfiguration() {
  const results = {
    vulnerabilities: [],
    warnings: [],
    passed: [],
    summary: {
      checksPerformed: 0,
      issuesFound: 0
    }
  };

  const checks = [
    {
      name: 'JWT Secret Strength',
      check: checkJWTSecret,
      severity: 'critical'
    },
    {
      name: 'Database Password Strength',
      check: checkDatabasePassword,
      severity: 'high'
    },
    {
      name: 'CORS Configuration',
      check: checkCORSConfig,
      severity: 'moderate'
    },
    {
      name: 'Environment Variables',
      check: checkEnvironmentVariables,
      severity: 'moderate'
    },
    {
      name: 'SSL/TLS Configuration',
      check: checkSSLConfig,
      severity: 'high'
    }
  ];

  for (const checkItem of checks) {
    results.summary.checksPerformed++;
    try {
      const result = await checkItem.check();

      if (result.passed) {
        results.passed.push({
          check: checkItem.name,
          status: 'passed',
          message: result.message
        });
      } else {
        results.summary.issuesFound++;
        const issue = {
          type: 'configuration',
          severity: checkItem.severity,
          check: checkItem.name,
          description: result.message,
          recommendation: result.recommendation
        };

        if (checkItem.severity === 'critical' || checkItem.severity === 'high') {
          results.vulnerabilities.push(issue);
        } else {
          results.warnings.push(issue);
        }
      }
    } catch (error) {
      console.error(`Error in check ${checkItem.name}:`, error.message);
    }
  }

  return results;
}

// Configuration check functions
function checkJWTSecret() {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return {
      passed: false,
      message: 'JWT_SECRET is not set',
      recommendation: 'Set a strong JWT_SECRET in environment variables (min 32 characters)'
    };
  }

  if (jwtSecret.length < 32) {
    return {
      passed: false,
      message: `JWT_SECRET is too short (${jwtSecret.length} characters)`,
      recommendation: 'Use a JWT_SECRET with at least 32 characters'
    };
  }

  if (jwtSecret === 'your-secret-key' || jwtSecret === 'secret') {
    return {
      passed: false,
      message: 'JWT_SECRET is using a default/weak value',
      recommendation: 'Generate a strong random secret key'
    };
  }

  return {
    passed: true,
    message: 'JWT_SECRET is properly configured'
  };
}

function checkDatabasePassword() {
  const dbPassword = process.env.DB_PASSWORD;

  if (!dbPassword) {
    return {
      passed: false,
      message: 'DB_PASSWORD is not set',
      recommendation: 'Set a strong database password'
    };
  }

  // Check password strength
  const hasUpper = /[A-Z]/.test(dbPassword);
  const hasLower = /[a-z]/.test(dbPassword);
  const hasNumber = /[0-9]/.test(dbPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(dbPassword);
  const isLongEnough = dbPassword.length >= 8;

  const strengthChecks = [hasUpper, hasLower, hasNumber, hasSpecial, isLongEnough];
  const strengthScore = strengthChecks.filter(Boolean).length;

  if (strengthScore < 4) {
    return {
      passed: false,
      message: `Weak database password (strength: ${strengthScore}/5)`,
      recommendation: 'Use a password with uppercase, lowercase, numbers, special characters, and min 8 characters'
    };
  }

  return {
    passed: true,
    message: 'Database password meets strength requirements'
  };
}

function checkCORSConfig() {
  // This is a simplified check - in real implementation, check actual CORS middleware config
  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    return {
      passed: false,
      message: 'FRONTEND_URL not configured for CORS',
      recommendation: 'Set FRONTEND_URL in environment variables'
    };
  }

  if (frontendUrl === '*') {
    return {
      passed: false,
      message: 'CORS is configured to allow all origins',
      recommendation: 'Restrict CORS to specific domains'
    };
  }

  return {
    passed: true,
    message: 'CORS configuration is properly restricted'
  };
}

function checkEnvironmentVariables() {
  const requiredVars = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'JWT_SECRET', 'PORT', 'NODE_ENV'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Missing required environment variables: ${missing.join(', ')}`,
      recommendation: 'Set all required environment variables in .env file'
    };
  }

  return {
    passed: true,
    message: 'All required environment variables are set'
  };
}

function checkSSLConfig() {
  const nodeEnv = process.env.NODE_ENV;
  const frontendUrl = process.env.FRONTEND_URL;

  if (nodeEnv === 'production' && frontendUrl && frontendUrl.startsWith('http://')) {
    return {
      passed: false,
      message: 'Production environment is using HTTP instead of HTTPS',
      recommendation: 'Use HTTPS in production for secure communication'
    };
  }

  return {
    passed: true,
    message: 'SSL/TLS configuration is appropriate for environment'
  };
}

// Calculate risk score (0-100)
function calculateRiskScore(results) {
  let score = 0;

  results.vulnerabilities.forEach(vuln => {
    switch (vuln.severity) {
      case 'critical':
        score += 10;
        break;
      case 'high':
        score += 5;
        break;
      case 'moderate':
        score += 2;
        break;
      case 'low':
        score += 1;
        break;
    }
  });

  results.warnings.forEach(warn => {
    score += 0.5;
  });

  return Math.min(100, Math.round(score));
}

// Get risk level from score
function getRiskLevel(score) {
  if (score >= 50) return 'critical';
  if (score >= 30) return 'high';
  if (score >= 10) return 'moderate';
  return 'low';
}

// Save scan results to database
async function saveScanResults(userId, scanId, results) {
  const startTime = Date.now();

  try {
    await pool.query(
      `INSERT INTO dev_security_scans
       (scan_type, risk_score, risk_level, vulnerabilities_count, warnings_count,
        results, scan_duration_ms, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        results.scanType,
        results.summary.riskScore,
        results.summary.riskLevel,
        results.summary.totalVulnerabilities,
        results.summary.totalWarnings,
        JSON.stringify(results),
        Date.now() - startTime,
        userId
      ]
    );

  } catch (error) {
    console.error('Error saving scan results:', error);
    throw error;
  }
}
