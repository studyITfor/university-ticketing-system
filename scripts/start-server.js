#!/usr/bin/env node
// scripts/start-server.js - Reliable server starter with process management

const commandRunner = require('./command-runner');
const processManager = require('./process-manager');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const options = {
        port: 3000,
        timeout: 30000,
        background: true,
        killExisting: true,
        saveLogs: true,
        waitForReady: true
    };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--port':
                options.port = parseInt(args[++i]) || 3000;
                break;
            case '--timeout':
                options.timeout = parseInt(args[++i]) || 30000;
                break;
            case '--foreground':
                options.background = false;
                break;
            case '--no-kill':
                options.killExisting = false;
                break;
            case '--no-wait':
                options.waitForReady = false;
                break;
            case '--no-logs':
                options.saveLogs = false;
                break;
            case '--help':
                console.log(`
Usage: node scripts/start-server.js [options]

Options:
  --port <number>       Port to run server on (default: 3000)
  --timeout <ms>        Startup timeout in milliseconds (default: 30000)
  --foreground          Run server in foreground (default: background)
  --no-kill             Don't kill existing processes on the port
  --no-wait             Don't wait for server to be ready
  --no-logs             Don't save execution logs
  --help                Show this help message

Examples:
  node scripts/start-server.js
  node scripts/start-server.js --port 8080 --foreground
  node scripts/start-server.js --no-kill --no-wait
                `);
                process.exit(0);
                break;
        }
    }

    console.log('🚀 Starting development server...');
    console.log(`📋 Configuration:`, options);

    try {
        // Check if port is already in use
        const isPortInUse = await commandRunner.isPortInUse(options.port);
        
        if (isPortInUse) {
            if (options.killExisting) {
                console.log(`🔄 Port ${options.port} is in use, killing existing processes...`);
                await commandRunner.killProcessOnPort(options.port);
            } else {
                console.error(`❌ Port ${options.port} is already in use`);
                console.error('💡 Use --no-kill to keep existing processes or choose a different port');
                process.exit(1);
            }
        }

        // Start server
        console.log(`🌐 Starting server on port ${options.port}...`);
        const serverResult = await commandRunner.startServer(options);

        if (!serverResult.success) {
            console.error('❌ Failed to start server:', serverResult.error);
            process.exit(1);
        }

        // Wait for server to be ready if requested
        if (options.waitForReady) {
            console.log('⏳ Waiting for server to be ready...');
            const isReady = await commandRunner.waitForService(`http://localhost:${options.port}`, {
                timeout: options.timeout,
                interval: 2000
            });

            if (!isReady) {
                console.error('❌ Server did not become ready within timeout');
                process.exit(1);
            }
        }

        // Save logs if requested
        if (options.saveLogs) {
            const logPath = path.join(process.cwd(), 'logs', `server-start-${Date.now()}.json`);
            await commandRunner.saveLogs(logPath);
            console.log(`💾 Server logs saved to: ${logPath}`);
        }

        // Report success
        console.log('✅ Server started successfully!');
        console.log(`🌐 Server URL: http://localhost:${options.port}`);
        console.log(`⏱️  Startup time: ${serverResult.duration}ms`);
        console.log(`📊 Process ID: ${serverResult.commandId}`);

        if (options.background) {
            console.log('🔄 Server is running in background');
            console.log('💡 Use Ctrl+C to stop the server');
            
            // Keep the process alive
            process.on('SIGINT', async () => {
                console.log('\n🛑 Stopping server...');
                await commandRunner.cleanup();
                process.exit(0);
            });
            
            // Keep alive
            setInterval(() => {}, 1000);
        } else {
            console.log('🔄 Server is running in foreground');
            console.log('💡 Press Ctrl+C to stop the server');
        }

    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        
        // Save error logs
        if (options.saveLogs) {
            const logPath = path.join(process.cwd(), 'logs', `server-error-${Date.now()}.json`);
            await commandRunner.saveLogs(logPath);
            console.log(`💾 Error logs saved to: ${logPath}`);
        }
        
        process.exit(1);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Server startup interrupted by user');
    await commandRunner.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Server startup terminated');
    await commandRunner.cleanup();
    process.exit(0);
});

// Run main function
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});
