const path = require('path');
const fs = require('fs');

/**
 * Environment Configuration Manager for OptiConnect GIS
 * Handles loading different .env files based on NODE_ENV
 *
 * USAGE:
 * - Development (Office Laptop): set NODE_ENV=development && npm start
 * - Production (Company Server): set NODE_ENV=production && npm start
 */

// Determine which environment file to load
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;
const envPath = path.join(__dirname, '..', '..', envFile);
const defaultEnvPath = path.join(__dirname, '..', '..', '.env');

console.log('');
console.log('========================================');
console.log('  OptiConnect GIS - Environment Config');
console.log('========================================');
console.log(`[ENV] Current NODE_ENV: ${env}`);
console.log(`[ENV] Looking for: ${envFile}`);

// Check if environment-specific file exists
if (fs.existsSync(envPath)) {
  console.log(`[ENV] ✅ Found ${envFile}`);
  console.log(`[ENV] Loading configuration from: ${envPath}`);
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(defaultEnvPath)) {
  console.log(`[ENV] ⚠️  ${envFile} not found, falling back to .env`);
  console.log(`[ENV] Loading configuration from: ${defaultEnvPath}`);
  require('dotenv').config({ path: defaultEnvPath });
} else {
  console.log(`[ENV] ℹ️  No .env file found - using system environment variables`);
  console.log(`[ENV] This is normal on production server with web.config`);
  // On production server with IIS, variables are set in web.config
  // No need to exit, just use environment variables directly
}

// Validate required environment variables
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'PORT',
  'JWT_SECRET'
];

console.log('[ENV] Validating required environment variables...');
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`[ENV] ❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

console.log('[ENV] ✅ All required environment variables are set');
console.log('========================================');
console.log('  Database Configuration');
console.log('========================================');
console.log(`[DB] Host: ${process.env.DB_HOST}`);
console.log(`[DB] Port: ${process.env.DB_PORT || 3306}`);
console.log(`[DB] Database: ${process.env.DB_NAME}`);
console.log(`[DB] User: ${process.env.DB_USER}`);
console.log('========================================');
console.log('  Server Configuration');
console.log('========================================');
console.log(`[Server] Port: ${process.env.PORT}`);
console.log(`[Server] Host: ${process.env.HOST || '0.0.0.0'} (network accessible)`);
console.log(`[Server] Environment: ${env}`);
console.log(`[Server] Frontend URL: ${process.env.FRONTEND_URL}`);
console.log('========================================');
console.log('');

module.exports = {
  env,
  isProduction: env === 'production',
  isDevelopment: env === 'development',
  config: process.env
};
