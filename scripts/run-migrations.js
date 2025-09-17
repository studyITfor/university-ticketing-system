#!/usr/bin/env node
// scripts/run-migrations.js - Reliable migration runner with process management

const commandRunner = require('./command-runner');
const processManager = require('./process-manager');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const options = {
        force: false,
        timeout: 120000,
        saveLogs: true,
        checkDatabase: true
    };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--force':
                options.force = true;
                break;
            case '--timeout':
                options.timeout = parseInt(args[++i]) || 120000;
                break;
            case '--no-db-check':
                options.checkDatabase = false;
                break;
            case '--no-logs':
                options.saveLogs = false;
                break;
            case '--help':
                console.log(`
Usage: node scripts/run-migrations.js [options]

Options:
  --force               Force migration even if database is not connected
  --timeout <ms>        Migration timeout in milliseconds (default: 120000)
  --no-db-check         Skip database connection check
  --no-logs             Don't save execution logs
  --help                Show this help message

Examples:
  node scripts/run-migrations.js
  node scripts/run-migrations.js --force
  node scripts/run-migrations.js --timeout 300000
                `);
                process.exit(0);
                break;
        }
    }

    console.log('🗄️ Starting database migration...');
    console.log(`📋 Configuration:`, options);

    try {
        // Check database connection if requested
        if (options.checkDatabase) {
            console.log('🔍 Checking database connection...');
            
            // Try to run a simple database check
            const dbCheckResult = await commandRunner.runNodeScript('backend/run_migrations.js', {
                args: ['--check-only'],
                timeout: 30000,
                env: { NODE_ENV: process.env.NODE_ENV || 'development' }
            });

            if (!dbCheckResult.success && !options.force) {
                console.error('❌ Database connection check failed');
                console.error('💡 Use --force to run migrations anyway');
                console.error('💡 Use --no-db-check to skip database check');
                process.exit(1);
            }
        }

        // Run migrations
        console.log('🔄 Running database migrations...');
        const migrationResult = await commandRunner.runMigrations(options);

        // Save logs if requested
        if (options.saveLogs) {
            const logPath = path.join(process.cwd(), 'logs', `migration-${Date.now()}.json`);
            await commandRunner.saveLogs(logPath);
            console.log(`💾 Migration logs saved to: ${logPath}`);
        }

        // Report results
        if (migrationResult.success) {
            console.log('✅ Migrations completed successfully!');
            console.log(`⏱️  Duration: ${migrationResult.duration}ms`);
            console.log(`📊 Exit code: ${migrationResult.exitCode}`);
            
            if (migrationResult.stdout) {
                console.log('📝 Migration output:');
                console.log(migrationResult.stdout);
            }
        } else {
            console.error('❌ Migrations failed!');
            console.error(`📊 Exit code: ${migrationResult.exitCode}`);
            console.error(`⏱️  Duration: ${migrationResult.duration}ms`);
            
            if (migrationResult.stderr) {
                console.error('📝 Error output:');
                console.error(migrationResult.stderr);
            }
            
            process.exit(migrationResult.exitCode || 1);
        }

    } catch (error) {
        console.error('❌ Migration execution failed:', error.message);
        
        // Save error logs
        if (options.saveLogs) {
            const logPath = path.join(process.cwd(), 'logs', `migration-error-${Date.now()}.json`);
            await commandRunner.saveLogs(logPath);
            console.log(`💾 Error logs saved to: ${logPath}`);
        }
        
        process.exit(1);
    } finally {
        // Cleanup
        await commandRunner.cleanup();
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Migration execution interrupted by user');
    await commandRunner.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Migration execution terminated');
    await commandRunner.cleanup();
    process.exit(0);
});

// Run main function
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});
