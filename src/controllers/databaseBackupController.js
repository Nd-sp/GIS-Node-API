const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { sendDevToolsNotification } = require('../services/emailService');

/**
 * Database Backup & Restore Controller
 * Works in both development and production modes
 */

const BACKUP_DIR = path.join(process.cwd(), '..', 'database_backups');

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
    // Don't throw - email failures shouldn't break the backup
  }
}

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Create database backup
exports.createBackup = async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username || req.user.email;
  const { description = '', includeData = true, tables = [] } = req.body;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    console.log(`Creating database backup: ${filename}`);

    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'opticonnectgis_db'
    };

    // Find mysqldump executable (Windows paths)
    const mysqldumpPaths = [
      'mysqldump', // Try PATH first
      'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysqldump.exe', // User's MySQL installation
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysqldump.exe',
      'C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
      'C:\\xampp\\mysql\\bin\\mysqldump.exe',
      'C:\\wamp64\\bin\\mysql\\mysql8.0.31\\bin\\mysqldump.exe'
    ];

    let mysqldumpExe = 'mysqldump';
    for (const path of mysqldumpPaths) {
      if (path !== 'mysqldump' && fs.existsSync(path)) {
        mysqldumpExe = `"${path}"`;
        break;
      }
    }

    // Build mysqldump command
    let mysqldumpCmd = `${mysqldumpExe} -h ${dbConfig.host} -u ${dbConfig.user}`;

    if (dbConfig.password) {
      mysqldumpCmd += ` -p"${dbConfig.password}"`;
    }

    // Options
    mysqldumpCmd += ' --single-transaction --quick --lock-tables=false';

    if (!includeData) {
      mysqldumpCmd += ' --no-data'; // Schema only
    }

    // Add database name
    mysqldumpCmd += ` ${dbConfig.database}`;

    // Specific tables if provided
    if (tables && tables.length > 0) {
      mysqldumpCmd += ` ${tables.join(' ')}`;
    }

    // Output to file
    mysqldumpCmd += ` > "${filepath}"`;

    // Execute backup
    const startTime = Date.now();
    try {
      await execPromise(mysqldumpCmd, {
        timeout: 300000, // 5 minutes timeout
        shell: 'cmd.exe'
      });
    } catch (execError) {
      // If mysqldump not found, provide helpful error
      if (execError.message.includes('not recognized')) {
        throw new Error(
          'mysqldump command not found. Please ensure MySQL is installed and either: ' +
          '1) Add MySQL bin directory to Windows PATH, or ' +
          '2) Install MySQL in a standard location (C:\\Program Files\\MySQL\\...)'
        );
      }
      throw execError;
    }
    const duration = Date.now() - startTime;

    // Get file size
    const stats = fs.statSync(filepath);
    const sizeBytes = stats.size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    // Count tables backed up
    let tableCount = 0;
    if (tables && tables.length > 0) {
      tableCount = tables.length;
    } else {
      // Count all tables
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?',
        [dbConfig.database]
      );
      tableCount = rows[0].count;
    }

    // Save backup metadata to database
    const [result] = await pool.query(
      `INSERT INTO dev_backups
       (filename, filepath, size_bytes, backup_type, tables_count,
        include_data, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        filename,
        filepath,
        sizeBytes,
        tables.length > 0 ? 'partial' : 'full',
        tableCount,
        includeData,
        description,
        userId
      ]
    );

    const backupId = result.insertId;

    console.log(`Backup created successfully: ${filename} (${sizeMB} MB)`);

    // Send email notification
    const durationSeconds = (duration / 1000).toFixed(2);
    await sendAdminNotifications('database_backup', 'create_backup', 'completed', durationSeconds, {
      tables_count: tableCount,
      size_mb: sizeMB,
      backup_type: tables.length > 0 ? 'partial' : 'full',
      filename: filename
    });

    res.json({
      success: true,
      message: 'Backup created successfully',
      data: {
        id: backupId,
        filename,
        size: `${sizeMB} MB`,
        sizeBytes,
        tableCount,
        duration: `${durationSeconds}s`,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Backup creation error:', error);

    // Send failure email notification
    await sendAdminNotifications('database_backup', 'create_backup', 'failed', null, {}, error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
};

// Get all backups
exports.getBackups = async (req, res) => {
  try {
    const [backups] = await pool.query(
      `SELECT
        b.id,
        b.filename,
        b.size_bytes,
        ROUND(b.size_bytes / (1024 * 1024), 2) as size_mb,
        b.backup_type,
        b.tables_count,
        b.include_data,
        b.description,
        b.created_at,
        b.created_by,
        u.username as created_by_name,
        b.restored_at,
        b.restored_by,
        u2.username as restored_by_name
       FROM dev_backups b
       LEFT JOIN users u ON b.created_by = u.id
       LEFT JOIN users u2 ON b.restored_by = u2.id
       ORDER BY b.created_at DESC
       LIMIT 100`
    );

    // Check if files still exist and convert size_mb to number
    const backupsWithStatus = backups.map(backup => {
      const exists = fs.existsSync(backup.filepath || path.join(BACKUP_DIR, backup.filename));
      return {
        ...backup,
        size_mb: Number(backup.size_mb) || 0,
        fileExists: exists,
        canRestore: exists && backup.include_data
      };
    });

    res.json({
      success: true,
      data: backupsWithStatus
    });

  } catch (error) {
    console.error('Get backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve backups',
      error: error.message
    });
  }
};

// Download backup file
exports.downloadBackup = async (req, res) => {
  const { backupId } = req.params;

  try {
    const [backups] = await pool.query(
      'SELECT * FROM dev_backups WHERE id = ?',
      [backupId]
    );

    if (backups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    const backup = backups[0];
    const filepath = backup.filepath || path.join(BACKUP_DIR, backup.filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found on disk'
      });
    }

    res.download(filepath, backup.filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to download backup',
            error: err.message
          });
        }
      }
    });

  } catch (error) {
    console.error('Download backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download backup',
      error: error.message
    });
  }
};

// Restore database from backup
exports.restoreBackup = async (req, res) => {
  const { backupId } = req.params;
  const userId = req.user.id;
  const username = req.user.username || req.user.email;
  const { confirmRestore = false } = req.body;

  if (!confirmRestore) {
    return res.status(400).json({
      success: false,
      message: 'Restore confirmation required',
      warning: 'This will overwrite the current database. Set confirmRestore: true to proceed.'
    });
  }

  try {
    const [backups] = await pool.query(
      'SELECT * FROM dev_backups WHERE id = ?',
      [backupId]
    );

    if (backups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    const backup = backups[0];
    const filepath = backup.filepath || path.join(BACKUP_DIR, backup.filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found on disk'
      });
    }

    console.log(`Restoring database from: ${backup.filename}`);

    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'opticonnectgis_db'
    };

    // Find mysql executable (Windows paths)
    const mysqlPaths = [
      'mysql', // Try PATH first
      'C:\\Program Files\\MySQL\\MySQL Server 9.5\\bin\\mysql.exe', // User's MySQL installation
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
      'C:\\Program Files\\MySQL\\MySQL Server 9.0\\bin\\mysql.exe',
      'C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe',
      'C:\\xampp\\mysql\\bin\\mysql.exe',
      'C:\\wamp64\\bin\\mysql\\mysql8.0.31\\bin\\mysql.exe'
    ];

    let mysqlExe = 'mysql';
    for (const path of mysqlPaths) {
      if (path !== 'mysql' && fs.existsSync(path)) {
        mysqlExe = `"${path}"`;
        break;
      }
    }

    // Build mysql restore command
    let mysqlCmd = `${mysqlExe} -h ${dbConfig.host} -u ${dbConfig.user}`;

    if (dbConfig.password) {
      mysqlCmd += ` -p"${dbConfig.password}"`;
    }

    mysqlCmd += ` ${dbConfig.database} < "${filepath}"`;

    // Execute restore
    const startTime = Date.now();
    try {
      await execPromise(mysqlCmd, {
        timeout: 300000, // 5 minutes timeout
        shell: 'cmd.exe'
      });
    } catch (execError) {
      // If mysql not found, provide helpful error
      if (execError.message.includes('not recognized')) {
        throw new Error(
          'mysql command not found. Please ensure MySQL is installed and either: ' +
          '1) Add MySQL bin directory to Windows PATH, or ' +
          '2) Install MySQL in a standard location (C:\\Program Files\\MySQL\\...)'
        );
      }
      throw execError;
    }
    const duration = Date.now() - startTime;

    // Update backup metadata
    await pool.query(
      'UPDATE dev_backups SET restored_at = NOW(), restored_by = ? WHERE id = ?',
      [userId, backupId]
    );

    console.log(`Database restored successfully from: ${backup.filename}`);

    res.json({
      success: true,
      message: 'Database restored successfully',
      data: {
        filename: backup.filename,
        duration: `${(duration / 1000).toFixed(2)}s`,
        restoredAt: new Date().toISOString(),
        restoredBy: username
      }
    });

  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore database',
      error: error.message,
      warning: 'The database may be in an inconsistent state. Please verify.'
    });
  }
};

// Delete backup
exports.deleteBackup = async (req, res) => {
  const { backupId } = req.params;
  const { deleteFile = true } = req.body;

  try {
    const [backups] = await pool.query(
      'SELECT * FROM dev_backups WHERE id = ?',
      [backupId]
    );

    if (backups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    const backup = backups[0];
    const filepath = backup.filepath || path.join(BACKUP_DIR, backup.filename);

    // Delete file if requested and exists
    if (deleteFile && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete database record
    await pool.query(
      'DELETE FROM dev_backups WHERE id = ?',
      [backupId]
    );

    res.json({
      success: true,
      message: 'Backup deleted successfully',
      data: {
        filename: backup.filename,
        fileDeleted: deleteFile
      }
    });

  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup',
      error: error.message
    });
  }
};

// Schedule automatic backup
exports.scheduleBackup = async (req, res) => {
  const userId = req.user.id;
  const { frequency, time, description, includeData = true } = req.body;

  // This is a placeholder - implement with node-cron or similar
  // For now, just save the schedule preference

  try {
    // In production, you would use node-cron to schedule backups
    // Example: cron.schedule('0 2 * * *', async () => { ... });

    res.json({
      success: true,
      message: 'Backup scheduling feature - to be implemented with node-cron',
      data: {
        frequency,
        time,
        description,
        note: 'This will be implemented with automated scheduling in production'
      }
    });

  } catch (error) {
    console.error('Schedule backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule backup',
      error: error.message
    });
  }
};

// Get backup statistics
exports.getBackupStats = async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total_backups,
        SUM(size_bytes) as total_size_bytes,
        ROUND(SUM(size_bytes) / (1024 * 1024), 2) as total_size_mb,
        ROUND(AVG(size_bytes) / (1024 * 1024), 2) as avg_size_mb,
        MAX(created_at) as last_backup_at,
        COUNT(CASE WHEN restored_at IS NOT NULL THEN 1 END) as restored_count
      FROM dev_backups
    `);

    const [recentBackups] = await pool.query(`
      SELECT id, filename, created_at,
             ROUND(size_bytes / (1024 * 1024), 2) as size_mb
      FROM dev_backups
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Convert string numbers to actual numbers for frontend
    const statsData = stats[0];
    const formattedStats = {
      total_backups: Number(statsData.total_backups) || 0,
      total_size_bytes: Number(statsData.total_size_bytes) || 0,
      total_size_mb: Number(statsData.total_size_mb) || 0,
      avg_size_mb: Number(statsData.avg_size_mb) || 0,
      last_backup_at: statsData.last_backup_at,
      restored_count: Number(statsData.restored_count) || 0
    };

    const formattedRecentBackups = recentBackups.map(backup => ({
      ...backup,
      size_mb: Number(backup.size_mb) || 0
    }));

    res.json({
      success: true,
      data: {
        stats: formattedStats,
        recentBackups: formattedRecentBackups
      }
    });

  } catch (error) {
    console.error('Get backup stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve backup statistics',
      error: error.message
    });
  }
};

// Verify backup integrity
exports.verifyBackup = async (req, res) => {
  const { backupId } = req.params;

  try {
    const [backups] = await pool.query(
      'SELECT * FROM dev_backups WHERE id = ?',
      [backupId]
    );

    if (backups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    const backup = backups[0];
    const filepath = backup.filepath || path.join(BACKUP_DIR, backup.filename);

    // Check file exists
    if (!fs.existsSync(filepath)) {
      return res.json({
        success: true,
        data: {
          valid: false,
          errors: ['Backup file not found on disk']
        }
      });
    }

    // Check file size matches
    const stats = fs.statSync(filepath);
    if (stats.size !== backup.size_bytes) {
      return res.json({
        success: true,
        data: {
          valid: false,
          errors: ['File size mismatch - backup may be corrupted'],
          expectedSize: backup.size_bytes,
          actualSize: stats.size
        }
      });
    }

    // Basic SQL syntax check
    const content = fs.readFileSync(filepath, 'utf-8');
    const hasHeader = content.includes('MySQL dump');
    const hasCreateTable = content.includes('CREATE TABLE');
    const hasProperEnd = content.includes('Dump completed');

    const errors = [];
    if (!hasHeader) errors.push('Missing MySQL dump header');
    if (!hasCreateTable) errors.push('No CREATE TABLE statements found');
    if (!hasProperEnd) errors.push('Incomplete dump - missing completion marker');

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors,
        checks: {
          fileExists: true,
          sizeMatches: true,
          hasValidHeader: hasHeader,
          hasCreateStatements: hasCreateTable,
          hasCompletionMarker: hasProperEnd
        }
      }
    });

  } catch (error) {
    console.error('Verify backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify backup',
      error: error.message
    });
  }
};
