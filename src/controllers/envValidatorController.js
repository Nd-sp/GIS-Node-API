const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { sendDevToolsNotification } = require('../services/emailService');

/**
 * Environment Configuration Validator Controller
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
    // Don't throw - email failures shouldn't break the validation
  }
}

// Validate environment configuration
exports.validateEnvironment = async (req, res) => {
  const userId = req.user.id;
  const startTime = Date.now();

  try {
    const validationId = Date.now();
    const results = {
      validationId,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      passed: [],
      warnings: [],
      errors: [],
      summary: {}
    };

    // Run validation checks
    console.log('Running environment validation...');

    // 1. Environment Variables Check
    const envVarsResult = validateEnvironmentVariables();
    results.passed.push(...envVarsResult.passed);
    results.warnings.push(...envVarsResult.warnings);
    results.errors.push(...envVarsResult.errors);

    // 2. Database Connection Check
    const dbResult = await validateDatabaseConnection();
    results.passed.push(...dbResult.passed);
    results.warnings.push(...dbResult.warnings);
    results.errors.push(...dbResult.errors);

    // 3. File System Check
    const fsResult = validateFileSystem();
    results.passed.push(...fsResult.passed);
    results.warnings.push(...fsResult.warnings);
    results.errors.push(...fsResult.errors);

    // 4. Node Modules Check
    const modulesResult = await validateNodeModules();
    results.passed.push(...modulesResult.passed);
    results.warnings.push(...modulesResult.warnings);
    results.errors.push(...modulesResult.errors);

    // 5. Port Availability Check
    const portsResult = await validatePorts();
    results.passed.push(...portsResult.passed);
    results.warnings.push(...portsResult.warnings);
    results.errors.push(...portsResult.errors);

    // 6. API Connectivity Check
    const apiResult = await validateAPIConnectivity();
    results.passed.push(...apiResult.passed);
    results.warnings.push(...apiResult.warnings);
    results.errors.push(...apiResult.errors);

    // 7. Production-specific checks
    if (process.env.NODE_ENV === 'production') {
      const prodResult = validateProductionConfig();
      results.passed.push(...prodResult.passed);
      results.warnings.push(...prodResult.warnings);
      results.errors.push(...prodResult.errors);
    }

    // Calculate summary
    results.summary = {
      totalChecks: results.passed.length + results.warnings.length + results.errors.length,
      passedChecks: results.passed.length,
      warningCount: results.warnings.length,
      errorCount: results.errors.length,
      overallStatus: results.errors.length === 0
        ? (results.warnings.length === 0 ? 'healthy' : 'warning')
        : 'error'
    };

    // Save validation results
    await saveValidationResults(userId, validationId, results);

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Send email notification
    await sendAdminNotifications('environment_validation', 'validate', 'completed', duration, {
      passed_checks: results.summary.passedChecks,
      warning_count: results.summary.warningCount,
      error_count: results.summary.errorCount,
      overall_status: results.summary.overallStatus,
      environment: results.environment
    });

    res.json({
      success: true,
      message: 'Environment validation completed',
      data: results
    });

  } catch (error) {
    console.error('Environment validation error:', error);

    // Send failure email notification
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    await sendAdminNotifications('environment_validation', 'validate', 'failed', duration, {}, error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to validate environment',
      error: error.message
    });
  }
};

// Get validation history
exports.getValidationHistory = async (req, res) => {
  try {
    const [validations] = await pool.query(
      `SELECT id, environment, overall_status,
              passed_checks, warning_count, error_count,
              created_at, created_by
       FROM dev_env_validations
       ORDER BY created_at DESC
       LIMIT 50`
    );

    res.json({
      success: true,
      data: validations
    });

  } catch (error) {
    console.error('Get validation history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve validation history',
      error: error.message
    });
  }
};

// Get validation details
exports.getValidationDetails = async (req, res) => {
  const { validationId } = req.params;

  try {
    const [validations] = await pool.query(
      'SELECT * FROM dev_env_validations WHERE id = ?',
      [validationId]
    );

    if (validations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Validation not found'
      });
    }

    const validation = validations[0];
    const results = JSON.parse(validation.results);

    // Merge database fields with results for frontend compatibility
    const combinedData = {
      ...results,
      id: validation.id,
      dbEnvironment: validation.environment,
      dbOverallStatus: validation.overall_status,
      dbPassedChecks: validation.passed_checks,
      dbWarningCount: validation.warning_count,
      dbErrorCount: validation.error_count,
      createdBy: validation.created_by,
      createdAt: validation.created_at
    };

    res.json({
      success: true,
      data: combinedData
    });

  } catch (error) {
    console.error('Get validation details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve validation details',
      error: error.message
    });
  }
};

// Delete validation
exports.deleteValidation = async (req, res) => {
  const { validationId } = req.params;

  try {
    // Check if validation exists
    const [validations] = await pool.query(
      'SELECT * FROM dev_env_validations WHERE id = ?',
      [validationId]
    );

    if (validations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Validation not found'
      });
    }

    // Delete the validation
    await pool.query('DELETE FROM dev_env_validations WHERE id = ?', [validationId]);

    res.json({
      success: true,
      message: 'Validation deleted successfully'
    });

  } catch (error) {
    console.error('Delete validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete validation',
      error: error.message
    });
  }
};

// ========== Validation Functions ==========

// Validate environment variables
function validateEnvironmentVariables() {
  const passed = [];
  const warnings = [];
  const errors = [];

  // Required variables for all environments
  const requiredVars = [
    { name: 'DB_HOST', description: 'Database host' },
    { name: 'DB_USER', description: 'Database user' },
    { name: 'DB_PASSWORD', description: 'Database password' },
    { name: 'DB_NAME', description: 'Database name' },
    { name: 'DB_PORT', description: 'Database port' },
    { name: 'JWT_SECRET', description: 'JWT secret key' },
    { name: 'PORT', description: 'Server port' },
    { name: 'NODE_ENV', description: 'Node environment' },
    { name: 'FRONTEND_URL', description: 'Frontend URL' }
  ];

  // Check each required variable
  requiredVars.forEach(varInfo => {
    const value = process.env[varInfo.name];

    if (!value) {
      errors.push({
        category: 'environment_variables',
        check: varInfo.name,
        status: 'error',
        message: `Missing required environment variable: ${varInfo.name}`,
        description: varInfo.description,
        recommendation: `Set ${varInfo.name} in .env file`
      });
    } else if (value.trim() === '') {
      errors.push({
        category: 'environment_variables',
        check: varInfo.name,
        status: 'error',
        message: `Empty value for ${varInfo.name}`,
        description: varInfo.description,
        recommendation: `Provide a valid value for ${varInfo.name}`
      });
    } else {
      // Check for default/insecure values
      const insecureDefaults = ['your-secret-key', 'secret', 'password', '123456', 'admin'];
      const isInsecure = insecureDefaults.some(def => value.toLowerCase().includes(def));

      if (varInfo.name.includes('SECRET') || varInfo.name.includes('PASSWORD')) {
        if (isInsecure) {
          warnings.push({
            category: 'environment_variables',
            check: varInfo.name,
            status: 'warning',
            message: `${varInfo.name} appears to use a default/insecure value`,
            recommendation: 'Generate a strong random secret'
          });
        } else {
          passed.push({
            category: 'environment_variables',
            check: varInfo.name,
            status: 'passed',
            message: `${varInfo.name} is properly configured`
          });
        }
      } else {
        passed.push({
          category: 'environment_variables',
          check: varInfo.name,
          status: 'passed',
          message: `${varInfo.name} is set`,
          value: varInfo.name === 'DB_PASSWORD' ? '***' : value
        });
      }
    }
  });

  // Optional but recommended variables
  const optionalVars = [
    { name: 'EMAIL_HOST', description: 'Email server host' },
    { name: 'EMAIL_USER', description: 'Email user' },
    { name: 'EMAIL_PASSWORD', description: 'Email password' }
  ];

  optionalVars.forEach(varInfo => {
    const value = process.env[varInfo.name];
    if (!value) {
      warnings.push({
        category: 'environment_variables',
        check: varInfo.name,
        status: 'warning',
        message: `Optional environment variable not set: ${varInfo.name}`,
        description: varInfo.description,
        recommendation: 'Set this variable if email functionality is needed'
      });
    }
  });

  return { passed, warnings, errors };
}

// Validate database connection
async function validateDatabaseConnection() {
  const passed = [];
  const warnings = [];
  const errors = [];

  try {
    // Test connection
    await pool.query('SELECT 1');
    passed.push({
      category: 'database',
      check: 'connection',
      status: 'passed',
      message: 'Database connection successful'
    });

    // Check database exists
    const dbName = process.env.DB_NAME;
    const [databases] = await pool.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbName]
    );

    if (databases.length > 0) {
      passed.push({
        category: 'database',
        check: 'database_exists',
        status: 'passed',
        message: `Database '${dbName}' exists`
      });
    } else {
      errors.push({
        category: 'database',
        check: 'database_exists',
        status: 'error',
        message: `Database '${dbName}' not found`,
        recommendation: 'Run DATABASE_SETUP.sql to create the database'
      });
    }

    // Check table count
    const [tables] = await pool.query(
      'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?',
      [dbName]
    );

    const tableCount = tables[0].count;
    if (tableCount >= 47) {
      passed.push({
        category: 'database',
        check: 'tables',
        status: 'passed',
        message: `${tableCount} tables found (expected 47+)`
      });
    } else if (tableCount > 0) {
      warnings.push({
        category: 'database',
        check: 'tables',
        status: 'warning',
        message: `Only ${tableCount} tables found (expected 47+)`,
        recommendation: 'Some migrations may not have been run'
      });
    } else {
      errors.push({
        category: 'database',
        check: 'tables',
        status: 'error',
        message: 'No tables found in database',
        recommendation: 'Run DATABASE_SETUP.sql to create tables'
      });
    }

    // Check critical tables exist
    const criticalTables = [
      'users', 'regions', 'infrastructure_items', 'boundary_versions',
      'groups', 'permissions', 'fiber_rings'
    ];

    for (const tableName of criticalTables) {
      const [tableCheck] = await pool.query(
        `SELECT COUNT(*) as count FROM information_schema.tables
         WHERE table_schema = ? AND table_name = ?`,
        [dbName, tableName]
      );

      if (tableCheck[0].count > 0) {
        passed.push({
          category: 'database',
          check: `table_${tableName}`,
          status: 'passed',
          message: `Table '${tableName}' exists`
        });
      } else {
        errors.push({
          category: 'database',
          check: `table_${tableName}`,
          status: 'error',
          message: `Critical table '${tableName}' not found`,
          recommendation: 'Run database migrations'
        });
      }
    }

  } catch (error) {
    errors.push({
      category: 'database',
      check: 'connection',
      status: 'error',
      message: 'Database connection failed',
      details: error.message,
      recommendation: 'Check database credentials and ensure MySQL is running'
    });
  }

  return { passed, warnings, errors };
}

// Validate file system
function validateFileSystem() {
  const passed = [];
  const warnings = [];
  const errors = [];

  // Check required directories
  const requiredDirs = [
    { path: path.join(process.cwd(), 'src'), name: 'Backend src directory' },
    { path: path.join(process.cwd(), '..', 'Frontend'), name: 'Frontend directory' },
    { path: path.join(process.cwd(), '..', 'Frontend', 'src'), name: 'Frontend src directory' },
    { path: path.join(process.cwd(), '..', 'Frontend', 'public'), name: 'Frontend public directory' }
  ];

  requiredDirs.forEach(dirInfo => {
    if (fs.existsSync(dirInfo.path)) {
      passed.push({
        category: 'filesystem',
        check: dirInfo.name,
        status: 'passed',
        message: `${dirInfo.name} exists`
      });
    } else {
      errors.push({
        category: 'filesystem',
        check: dirInfo.name,
        status: 'error',
        message: `${dirInfo.name} not found`,
        path: dirInfo.path,
        recommendation: 'Ensure project structure is intact'
      });
    }
  });

  // Check required files
  const requiredFiles = [
    { path: path.join(process.cwd(), '.env'), name: 'Backend .env file' },
    { path: path.join(process.cwd(), 'package.json'), name: 'Backend package.json' },
    { path: path.join(process.cwd(), '..', 'Frontend', '.env'), name: 'Frontend .env file' },
    { path: path.join(process.cwd(), '..', 'Frontend', 'package.json'), name: 'Frontend package.json' }
  ];

  requiredFiles.forEach(fileInfo => {
    if (fs.existsSync(fileInfo.path)) {
      passed.push({
        category: 'filesystem',
        check: fileInfo.name,
        status: 'passed',
        message: `${fileInfo.name} exists`
      });
    } else {
      errors.push({
        category: 'filesystem',
        check: fileInfo.name,
        status: 'error',
        message: `${fileInfo.name} not found`,
        path: fileInfo.path,
        recommendation: 'Create or restore this file'
      });
    }
  });

  // Check write permissions for critical directories
  const writableDirs = [
    { path: path.join(process.cwd(), '..', 'database_backups'), name: 'Backup directory' },
    { path: path.join(process.cwd(), '..', 'logs'), name: 'Logs directory' }
  ];

  writableDirs.forEach(dirInfo => {
    try {
      if (!fs.existsSync(dirInfo.path)) {
        fs.mkdirSync(dirInfo.path, { recursive: true });
      }

      fs.accessSync(dirInfo.path, fs.constants.W_OK);
      passed.push({
        category: 'filesystem',
        check: dirInfo.name,
        status: 'passed',
        message: `${dirInfo.name} is writable`
      });
    } catch (error) {
      warnings.push({
        category: 'filesystem',
        check: dirInfo.name,
        status: 'warning',
        message: `${dirInfo.name} is not writable`,
        recommendation: 'Check directory permissions'
      });
    }
  });

  return { passed, warnings, errors };
}

// Validate node modules
async function validateNodeModules() {
  const passed = [];
  const warnings = [];
  const errors = [];

  try {
    // Check Backend node_modules
    const backendModulesPath = path.join(process.cwd(), 'node_modules');
    if (fs.existsSync(backendModulesPath)) {
      passed.push({
        category: 'dependencies',
        check: 'backend_node_modules',
        status: 'passed',
        message: 'Backend node_modules directory exists'
      });

      // Check critical packages
      const criticalPackages = ['express', 'mysql2', 'jsonwebtoken', 'bcryptjs', 'ws'];
      criticalPackages.forEach(pkg => {
        const pkgPath = path.join(backendModulesPath, pkg);
        if (fs.existsSync(pkgPath)) {
          passed.push({
            category: 'dependencies',
            check: `backend_package_${pkg}`,
            status: 'passed',
            message: `Package '${pkg}' is installed`
          });
        } else {
          errors.push({
            category: 'dependencies',
            check: `backend_package_${pkg}`,
            status: 'error',
            message: `Critical package '${pkg}' is missing`,
            recommendation: 'Run npm install in Backend directory'
          });
        }
      });

    } else {
      errors.push({
        category: 'dependencies',
        check: 'backend_node_modules',
        status: 'error',
        message: 'Backend node_modules directory not found',
        recommendation: 'Run npm install in Backend directory'
      });
    }

    // Check Frontend node_modules
    const frontendModulesPath = path.join(process.cwd(), '..', 'Frontend', 'node_modules');
    if (fs.existsSync(frontendModulesPath)) {
      passed.push({
        category: 'dependencies',
        check: 'frontend_node_modules',
        status: 'passed',
        message: 'Frontend node_modules directory exists'
      });
    } else {
      warnings.push({
        category: 'dependencies',
        check: 'frontend_node_modules',
        status: 'warning',
        message: 'Frontend node_modules directory not found',
        recommendation: 'Run npm install in Frontend directory'
      });
    }

  } catch (error) {
    errors.push({
      category: 'dependencies',
      check: 'node_modules_validation',
      status: 'error',
      message: 'Failed to validate node_modules',
      details: error.message
    });
  }

  return { passed, warnings, errors };
}

// Validate ports
async function validatePorts() {
  const passed = [];
  const warnings = [];
  const errors = [];

  const backendPort = process.env.PORT || 82;
  const frontendPort = 3005;

  // Check if backend port is in use (should be)
  try {
    const { stdout } = await execPromise(`netstat -ano | findstr :${backendPort}`, {
      timeout: 5000
    });

    if (stdout.includes('LISTENING')) {
      passed.push({
        category: 'ports',
        check: 'backend_port',
        status: 'passed',
        message: `Backend is listening on port ${backendPort}`
      });
    }
  } catch (error) {
    warnings.push({
      category: 'ports',
      check: 'backend_port',
      status: 'warning',
      message: `Backend port ${backendPort} is not in use`,
      recommendation: 'Start the backend server'
    });
  }

  return { passed, warnings, errors };
}

// Validate API connectivity
async function validateAPIConnectivity() {
  const passed = [];
  const warnings = [];
  const errors = [];

  // This is a basic check - in production you might test actual endpoints
  passed.push({
    category: 'api',
    check: 'server_running',
    status: 'passed',
    message: 'API server is running (this endpoint is working)'
  });

  return { passed, warnings, errors };
}

// Validate production-specific configuration
function validateProductionConfig() {
  const passed = [];
  const warnings = [];
  const errors = [];

  // Check HTTPS
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && frontendUrl.startsWith('http://')) {
    errors.push({
      category: 'production',
      check: 'https',
      status: 'error',
      message: 'Production environment must use HTTPS',
      recommendation: 'Update FRONTEND_URL to use https://'
    });
  } else {
    passed.push({
      category: 'production',
      check: 'https',
      status: 'passed',
      message: 'Using HTTPS for frontend URL'
    });
  }

  // Check JWT secret strength (production should have stronger secrets)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 64) {
    warnings.push({
      category: 'production',
      check: 'jwt_secret_strength',
      status: 'warning',
      message: 'JWT_SECRET should be longer in production (64+ characters)',
      recommendation: 'Generate a stronger secret for production'
    });
  } else {
    passed.push({
      category: 'production',
      check: 'jwt_secret_strength',
      status: 'passed',
      message: 'JWT_SECRET meets production strength requirements'
    });
  }

  return { passed, warnings, errors };
}

// Save validation results
async function saveValidationResults(userId, validationId, results) {
  try {
    await pool.query(
      `INSERT INTO dev_env_validations
       (environment, overall_status, passed_checks, warning_count,
        error_count, results, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        results.environment,
        results.summary.overallStatus,
        results.summary.passedChecks,
        results.summary.warningCount,
        results.summary.errorCount,
        JSON.stringify(results),
        userId
      ]
    );

  } catch (error) {
    console.error('Error saving validation results:', error);
    throw error;
  }
}
