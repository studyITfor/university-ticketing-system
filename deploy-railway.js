#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Railway deployment process...');

// Check if Railway CLI is installed
try {
    execSync('railway --version', { stdio: 'pipe' });
    console.log('✅ Railway CLI is installed');
} catch (error) {
    console.error('❌ Railway CLI is not installed. Please install it first:');
    console.error('   npm install -g @railway/cli');
    console.error('   or visit: https://docs.railway.app/develop/cli');
    process.exit(1);
}

// Check if user is logged in
try {
    execSync('railway whoami', { stdio: 'pipe' });
    console.log('✅ Logged in to Railway');
} catch (error) {
    console.error('❌ Not logged in to Railway. Please run: railway login');
    process.exit(1);
}

// Create or link to project
try {
    console.log('🔗 Linking to Railway project...');
    execSync('railway link', { stdio: 'inherit' });
    console.log('✅ Project linked successfully');
} catch (error) {
    console.error('❌ Failed to link project:', error.message);
    process.exit(1);
}

// Set environment variables
console.log('🔧 Setting environment variables...');
const envVars = [
    'NODE_ENV=production',
    'PORT=3000'
];

for (const envVar of envVars) {
    try {
        execSync(`railway variables set ${envVar}`, { stdio: 'pipe' });
        console.log(`✅ Set ${envVar}`);
    } catch (error) {
        console.warn(`⚠️ Failed to set ${envVar}:`, error.message);
    }
}

// Deploy the application
try {
    console.log('🚀 Deploying to Railway...');
    execSync('railway up', { stdio: 'inherit' });
    console.log('✅ Deployment completed successfully!');
    
    // Get the deployment URL
    try {
        const url = execSync('railway domain', { stdio: 'pipe' }).toString().trim();
        console.log(`🌐 Application URL: https://${url}`);
        console.log('📱 Admin panel: https://' + url + '/admin.html');
        console.log('🎓 Student portal: https://' + url + '/index.html');
    } catch (error) {
        console.log('ℹ️ Run "railway domain" to get your application URL');
    }
    
} catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
}

console.log('🎉 Railway deployment process completed!');
console.log('');
console.log('📋 Next steps:');
console.log('1. Set up PostgreSQL database in Railway dashboard');
console.log('2. Add DATABASE_URL environment variable');
console.log('3. Test the application on multiple devices');
console.log('4. Verify real-time synchronization works');
