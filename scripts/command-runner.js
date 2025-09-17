// scripts/command-runner.js
const processManager = require('./process-manager');
const path = require('path');
const fs = require('fs');

class CommandRunner {
    constructor() {
        this.projectRoot = process.cwd();
        this.logs = [];
    }

    /**
     * Run Playwright tests with proper configuration
     * @param {Object} options - Test options
     * @returns {Promise<Object>} - Test results
     */
    async runPlaywrightTests(options = {}) {
        const {
            testPattern = 'tests/e2e/*.spec.js',
            headed = false,
            workers = 1,
            timeout = 300000, // 5 minutes
            reporter = 'list',
            retries = 0
        } = options;

        const command = [
            'npx playwright test',
            testPattern,
            headed ? '--headed' : '',
            `--workers=${workers}`,
            `--timeout=${timeout}`,
            `--reporter=${reporter}`,
            retries > 0 ? `--retries=${retries}` : ''
        ].filter(Boolean).join(' ');

        this.log(`🎭 Running Playwright tests: ${testPattern}`);

        return await this.executeCommand(command, {
            timeout: timeout + 60000, // Add extra time for setup
            workingDir: this.projectRoot,
            env: {
                ...process.env,
                DEBUG: 'pw:api',
                PLAYWRIGHT_BROWSERS_PATH: '0' // Use system browsers
            },
            logPrefix: '[PLAYWRIGHT]'
        });
    }

    /**
     * Run database migrations
     * @param {Object} options - Migration options
     * @returns {Promise<Object>} - Migration results
     */
    async runMigrations(options = {}) {
        const {
            timeout = 120000, // 2 minutes
            force = false
        } = options;

        const command = force ? 'npm run migrate:force' : 'npm run migrate';

        this.log(`🗄️ Running database migrations...`);

        return await this.executeCommand(command, {
            timeout,
            workingDir: this.projectRoot,
            env: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV || 'development'
            },
            logPrefix: '[MIGRATE]'
        });
    }

    /**
     * Start the development server
     * @param {Object} options - Server options
     * @returns {Promise<Object>} - Server start results
     */
    async startServer(options = {}) {
        const {
            port = 3000,
            timeout = 30000, // 30 seconds to start
            background = true
        } = options;

        // Check if server is already running
        const isRunning = await this.isPortInUse(port);
        if (isRunning) {
            this.log(`⚠️ Port ${port} is already in use`);
            if (options.killExisting) {
                await this.killProcessOnPort(port);
            } else {
                return {
                    success: false,
                    error: `Port ${port} is already in use`,
                    exitCode: -1
                };
            }
        }

        const command = 'npm start';

        this.log(`🚀 Starting development server on port ${port}...`);

        const result = await this.executeCommand(command, {
            timeout: background ? timeout : 0, // No timeout for background processes
            workingDir: this.projectRoot,
            env: {
                ...process.env,
                PORT: port.toString(),
                NODE_ENV: process.env.NODE_ENV || 'development'
            },
            logPrefix: '[SERVER]',
            allowFailure: false
        });

        if (background && result.success) {
            this.log(`✅ Server started in background`);
        }

        return result;
    }

    /**
     * Run a custom Node.js script
     * @param {string} scriptPath - Path to the script
     * @param {Object} options - Script options
     * @returns {Promise<Object>} - Script results
     */
    async runNodeScript(scriptPath, options = {}) {
        const {
            args = [],
            timeout = 120000,
            env = {}
        } = options;

        const fullPath = path.resolve(this.projectRoot, scriptPath);
        
        if (!fs.existsSync(fullPath)) {
            throw new Error(`Script not found: ${fullPath}`);
        }

        const command = `node ${scriptPath} ${args.join(' ')}`.trim();

        this.log(`📜 Running Node script: ${scriptPath}`);

        return await this.executeCommand(command, {
            timeout,
            workingDir: this.projectRoot,
            env: {
                ...process.env,
                ...env
            },
            logPrefix: '[NODE]'
        });
    }

    /**
     * Run npm scripts
     * @param {string} scriptName - NPM script name
     * @param {Object} options - Script options
     * @returns {Promise<Object>} - Script results
     */
    async runNpmScript(scriptName, options = {}) {
        const {
            args = [],
            timeout = 300000,
            env = {}
        } = options;

        const command = `npm run ${scriptName} ${args.join(' ')}`.trim();

        this.log(`📦 Running NPM script: ${scriptName}`);

        return await this.executeCommand(command, {
            timeout,
            workingDir: this.projectRoot,
            env: {
                ...process.env,
                ...env
            },
            logPrefix: '[NPM]'
        });
    }

    /**
     * Execute a generic command
     * @param {string} command - Command to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Command results
     */
    async executeCommand(command, options = {}) {
        const {
            timeout = 300000,
            workingDir = this.projectRoot,
            env = process.env,
            logPrefix = '[CMD]',
            allowFailure = false
        } = options;

        try {
            const result = await processManager.executeCommand(command, {
                timeout,
                workingDir,
                env,
                logPrefix,
                allowFailure,
                killExisting: true
            });

            // Store logs
            this.logs.push({
                timestamp: new Date().toISOString(),
                command,
                result,
                logs: processManager.getCommandLogs(result.commandId)
            });

            return result;
        } catch (error) {
            this.log(`❌ Command execution failed: ${error.message}`, '[ERROR]');
            throw error;
        }
    }

    /**
     * Check if a port is in use
     * @param {number} port - Port number to check
     * @returns {Promise<boolean>} - True if port is in use
     */
    async isPortInUse(port) {
        try {
            const { stdout } = await processManager.executeCommand(
                process.platform === 'win32' 
                    ? `netstat -ano | findstr :${port}`
                    : `lsof -i :${port}`,
                {
                    timeout: 10000,
                    killExisting: false,
                    allowFailure: true
                }
            );
            return stdout.includes(port.toString());
        } catch (error) {
            return false;
        }
    }

    /**
     * Kill process running on a specific port
     * @param {number} port - Port number
     * @returns {Promise<void>}
     */
    async killProcessOnPort(port) {
        try {
            if (process.platform === 'win32') {
                const { stdout } = await processManager.executeCommand(
                    `netstat -ano | findstr :${port}`,
                    { timeout: 10000, killExisting: false, allowFailure: true }
                );
                
                const lines = stdout.split('\n').filter(line => line.includes(`:${port}`));
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    const pid = parts[parts.length - 1];
                    if (pid && !isNaN(pid)) {
                        await processManager.executeCommand(
                            `taskkill /F /PID ${pid}`,
                            { timeout: 10000, killExisting: false, allowFailure: true }
                        );
                        this.log(`🔄 Killed process ${pid} on port ${port}`);
                    }
                }
            } else {
                await processManager.executeCommand(
                    `lsof -ti:${port} | xargs kill -9`,
                    { timeout: 10000, killExisting: false, allowFailure: true }
                );
                this.log(`🔄 Killed processes on port ${port}`);
            }
        } catch (error) {
            this.log(`⚠️ Could not kill process on port ${port}: ${error.message}`);
        }
    }

    /**
     * Wait for a service to be ready
     * @param {string} url - URL to check
     * @param {Object} options - Wait options
     * @returns {Promise<boolean>} - True if service is ready
     */
    async waitForService(url, options = {}) {
        const {
            timeout = 60000,
            interval = 2000,
            maxAttempts = 30
        } = options;

        this.log(`⏳ Waiting for service at ${url}...`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const response = await fetch(url, { 
                    method: 'HEAD',
                    timeout: 5000 
                });
                
                if (response.ok) {
                    this.log(`✅ Service is ready at ${url}`);
                    return true;
                }
            } catch (error) {
                // Service not ready yet
            }

            if (attempt < maxAttempts) {
                this.log(`⏳ Attempt ${attempt}/${maxAttempts} - waiting ${interval}ms...`);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }

        this.log(`❌ Service not ready after ${maxAttempts} attempts`);
        return false;
    }

    /**
     * Log a message
     * @param {string} message - Message to log
     * @param {string} prefix - Log prefix
     */
    log(message, prefix = '[RUNNER]') {
        const timestamp = new Date().toISOString();
        console.log(`${timestamp} ${prefix} ${message}`);
    }

    /**
     * Get execution logs
     * @returns {Array} - Execution logs
     */
    getLogs() {
        return this.logs;
    }

    /**
     * Save execution logs to file
     * @param {string} filePath - Path to save logs
     * @returns {Promise<void>}
     */
    async saveLogs(filePath) {
        const logData = {
            timestamp: new Date().toISOString(),
            projectRoot: this.projectRoot,
            logs: this.logs,
            processManagerLogs: processManager.getRecentLogs()
        };

        await fs.promises.writeFile(filePath, JSON.stringify(logData, null, 2));
        this.log(`💾 Execution logs saved to ${filePath}`);
    }

    /**
     * Cleanup all running processes
     * @returns {Promise<void>}
     */
    async cleanup() {
        this.log(`🧹 Cleaning up all running processes...`);
        processManager.killAllProcesses();
    }
}

// Export singleton instance
module.exports = new CommandRunner();
