#!/usr/bin/env node
// scripts/run-tests.js - Reliable test runner with process management

const commandRunner = require('./command-runner');
const processManager = require('./process-manager');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const options = {
        testPattern: 'tests/e2e/*.spec.js',
        headed: false,
        workers: 1,
        timeout: 300000,
        reporter: 'list',
        retries: 0,
        saveLogs: true
    };

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--headed':
                options.headed = true;
                break;
            case '--workers':
                options.workers = parseInt(args[++i]) || 1;
                break;
            case '--timeout':
                options.timeout = parseInt(args[++i]) || 300000;
                break;
            case '--pattern':
                options.testPattern = args[++i] || 'tests/e2e/*.spec.js';
                break;
            case '--reporter':
                options.reporter = args[++i] || 'list';
                break;
            case '--retries':
                options.retries = parseInt(args[++i]) || 0;
                break;
            case '--no-logs':
                options.saveLogs = false;
                break;
            case '--help':
                console.log(`
Usage: node scripts/run-tests.js [options]

Options:
  --headed              Run tests in headed mode (show browser)
  --workers <number>    Number of parallel workers (default: 1)
  --timeout <ms>        Test timeout in milliseconds (default: 300000)
  --pattern <pattern>   Test file pattern (default: tests/e2e/*.spec.js)
  --reporter <name>     Reporter to use (default: list)
  --retries <number>    Number of retries for failed tests (default: 0)
  --no-logs             Don't save execution logs
  --help                Show this help message

Examples:
  node scripts/run-tests.js
  node scripts/run-tests.js --headed --workers 2
  node scripts/run-tests.js --pattern "tests/e2e/booking*.spec.js"
                `);
                process.exit(0);
                break;
        }
    }

    console.log('🧪 Starting Playwright test execution...');
    console.log(`📋 Configuration:`, options);

    try {
        // Ensure server is running
        console.log('🔍 Checking if server is running...');
        const isServerRunning = await commandRunner.isPortInUse(3000);
        
        if (!isServerRunning) {
            console.log('🚀 Starting development server...');
            const serverResult = await commandRunner.startServer({
                port: 3000,
                background: true,
                timeout: 30000
            });
            
            if (!serverResult.success) {
                console.error('❌ Failed to start server:', serverResult.error);
                process.exit(1);
            }

            // Wait for server to be ready
            const isReady = await commandRunner.waitForService('http://localhost:3000', {
                timeout: 60000,
                interval: 2000
            });

            if (!isReady) {
                console.error('❌ Server did not become ready within timeout');
                process.exit(1);
            }
        } else {
            console.log('✅ Server is already running');
        }

        // Run tests
        console.log('🎭 Running Playwright tests...');
        const testResult = await commandRunner.runPlaywrightTests(options);

        // Save logs if requested
        if (options.saveLogs) {
            const logPath = path.join(process.cwd(), 'logs', `test-execution-${Date.now()}.json`);
            await commandRunner.saveLogs(logPath);
            console.log(`💾 Test logs saved to: ${logPath}`);
        }

        // Report results
        if (testResult.success) {
            console.log('✅ All tests passed!');
            console.log(`⏱️  Duration: ${testResult.duration}ms`);
            console.log(`📊 Exit code: ${testResult.exitCode}`);
        } else {
            console.error('❌ Tests failed!');
            console.error(`📊 Exit code: ${testResult.exitCode}`);
            console.error(`⏱️  Duration: ${testResult.duration}ms`);
            
            if (testResult.stderr) {
                console.error('📝 Error output:');
                console.error(testResult.stderr);
            }
            
            process.exit(testResult.exitCode || 1);
        }

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        
        // Save error logs
        if (options.saveLogs) {
            const logPath = path.join(process.cwd(), 'logs', `test-error-${Date.now()}.json`);
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
    console.log('\n🛑 Test execution interrupted by user');
    await commandRunner.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Test execution terminated');
    await commandRunner.cleanup();
    process.exit(0);
});

// Run main function
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});
