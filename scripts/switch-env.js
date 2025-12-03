#!/usr/bin/env node
/**
 * Environment Switcher for OptiConnect GIS Backend
 * 
 * Usage:
 *   node scripts/switch-env.js development   - Switch to development mode
 *   node scripts/switch-env.js production    - Switch to production mode
 */

const fs = require('fs');
const path = require('path');

const env = process.argv[2] || 'development';
const validEnvs = ['development', 'production'];

if (!validEnvs.includes(env)) {
    console.error(`Invalid environment: ${env}`);
    console.log(`Valid options: ${validEnvs.join(', ')}`);
    process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const sourceFile = path.join(rootDir, `.env.${env}`);
const targetFile = path.join(rootDir, '.env');

if (!fs.existsSync(sourceFile)) {
    console.error(`Environment file not found: .env.${env}`);
    process.exit(1);
}

// Copy the environment file
const content = fs.readFileSync(sourceFile, 'utf8');
fs.writeFileSync(targetFile, content);

console.log('');
console.log('=====================================================');
console.log(`  OptiConnect GIS Backend - Environment Switched`);
console.log('=====================================================');
console.log(`  Mode: ${env.toUpperCase()}`);
console.log(`  Source: .env.${env}`);
console.log(`  Target: .env`);
console.log('=====================================================');

if (env === 'development') {
    console.log('  Database: localhost:3306');
    console.log('  Server: http://localhost:82');
    console.log('  Frontend CORS: http://localhost:3005');
    console.log('');
    console.log('  To start development server:');
    console.log('    npm run dev');
} else {
    console.log('  Database: 172.16.20.6:3306');
    console.log('  Server: http://172.16.20.6:82');
    console.log('  Frontend CORS: http://172.16.20.6:81');
    console.log('');
    console.log('  To start production server:');
    console.log('    npm start');
}
console.log('=====================================================');
console.log('');
