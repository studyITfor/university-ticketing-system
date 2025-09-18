// scripts/process-manager.js
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProcessManager {
    constructor() {
        this.runningProcesses = new Map();
        this.logs = [];
        this.maxLogSize = 1000; // Keep last 1000 log entries
    }

    /**
     * Execute a command with proper process handling
     * @param {string} command - The command to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} - Execution result
     */
    async executeCommand(command, options = {}) {
        const {
            timeout = 300000, // 5 minutes default timeout
            workingDir = process.cwd(),
            env = process.env,
            captureOutput = true,
            killExisting = true,
            logPrefix = '[CMD]',
            allowFailure = false
        } = options;

        const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

        this.log(`🚀 Starting command: ${command}`, logPrefix, commandId);

        try {
            // Check for existing processes if killExisting is true
            if (killExisting) {
                await this.killExistingProcesses(command);
            }

            // Parse command and arguments
            const [cmd, ...args] = command.split(' ');
            
            // Create process
            const childProcess = spawn(cmd, args, {
                cwd: workingDir,
                env: { ...env },
                stdio: captureOutput ? 'pipe' : 'inherit',
                shell: true,
                windowsHide: true
            });

            // Store process reference
            this.runningProcesses.set(commandId, {
                process: childProcess,
                command,
                startTime,
                logs: []
            });

            // Set up output capture
            let stdout = '';
            let stderr = '';

            if (captureOutput) {
                childProcess.stdout?.on('data', (data) => {
                    const output = data.toString();
                    stdout += output;
                    this.log(output.trim(), logPrefix, commandId, 'stdout');
                });

                childProcess.stderr?.on('data', (data) => {
                    const output = data.toString();
                    stderr += output;
                    this.log(output.trim(), logPrefix, commandId, 'stderr');
                });
            }

            // Set up timeout
            const timeoutId = setTimeout(() => {
                this.log(`⏰ Command timeout after ${timeout}ms`, logPrefix, commandId, 'timeout');
                this.killProcess(commandId);
            }, timeout);

            // Wait for process to complete
            const exitCode = await new Promise((resolve, reject) => {
                childProcess.on('close', (code, signal) => {
                    clearTimeout(timeoutId);
                    this.runningProcesses.delete(commandId);
                    
                    const duration = Date.now() - startTime;
                    this.log(`✅ Command completed in ${duration}ms with exit code: ${code}`, logPrefix, commandId);
                    
                    if (code === 0) {
                        resolve(code);
                    } else if (allowFailure) {
                        resolve(code);
                    } else {
                        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
                    }
                });

                childProcess.on('error', (error) => {
                    clearTimeout(timeoutId);
                    this.runningProcesses.delete(commandId);
                    this.log(`❌ Command error: ${error.message}`, logPrefix, commandId, 'error');
                    reject(error);
                });
            });

            return {
                success: exitCode === 0,
                exitCode,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                duration: Date.now() - startTime,
                commandId
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.log(`❌ Command failed after ${duration}ms: ${error.message}`, logPrefix, commandId, 'error');
            
            return {
                success: false,
                exitCode: -1,
                stdout: '',
                stderr: error.message,
                duration,
                commandId,
                error: error.message
            };
        }
    }

    /**
     * Kill existing processes that match the command pattern
     * @param {string} command - Command pattern to match
     */
    async killExistingProcesses(command) {
        const [cmd] = command.split(' ');
        
        try {
            // On Windows, use tasklist and taskkill
            if (process.platform === 'win32') {
                const { stdout } = await this.executeCommand(`tasklist /FI "IMAGENAME eq ${cmd}.exe" /FO CSV`, {
                    timeout: 10000,
                    captureOutput: true,
                    killExisting: false,
                    allowFailure: true
                });

                if (stdout.includes(cmd)) {
                    this.log(`🔄 Killing existing ${cmd} processes...`);
                    await this.executeCommand(`taskkill /F /IM ${cmd}.exe`, {
                        timeout: 10000,
                        killExisting: false,
                        allowFailure: true
                    });
                }
            } else {
                // On Unix-like systems, use ps and kill
                const { stdout } = await this.executeCommand(`ps aux | grep ${cmd} | grep -v grep`, {
                    timeout: 10000,
                    captureOutput: true,
                    killExisting: false,
                    allowFailure: true
                });

                if (stdout.trim()) {
                    this.log(`🔄 Killing existing ${cmd} processes...`);
                    await this.executeCommand(`pkill -f ${cmd}`, {
                        timeout: 10000,
                        killExisting: false,
                        allowFailure: true
                    });
                }
            }
        } catch (error) {
            this.log(`⚠️ Could not check for existing processes: ${error.message}`);
        }
    }

    /**
     * Kill a specific process by command ID
     * @param {string} commandId - Command ID to kill
     */
    killProcess(commandId) {
        const processInfo = this.runningProcesses.get(commandId);
        if (processInfo) {
            try {
                processInfo.process.kill('SIGTERM');
                this.log(`🔄 Process ${commandId} terminated`);
            } catch (error) {
                this.log(`❌ Error killing process ${commandId}: ${error.message}`);
            }
        }
    }

    /**
     * Kill all running processes
     */
    killAllProcesses() {
        this.log(`🔄 Killing all ${this.runningProcesses.size} running processes...`);
        for (const [commandId, processInfo] of this.runningProcesses) {
            try {
                processInfo.process.kill('SIGTERM');
            } catch (error) {
                this.log(`❌ Error killing process ${commandId}: ${error.message}`);
            }
        }
        this.runningProcesses.clear();
    }

    /**
     * Log a message with timestamp and context
     * @param {string} message - Message to log
     * @param {string} prefix - Log prefix
     * @param {string} commandId - Command ID
     * @param {string} type - Log type (stdout, stderr, error, etc.)
     */
    log(message, prefix = '[LOG]', commandId = null, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            prefix,
            commandId,
            type,
            message
        };

        this.logs.push(logEntry);
        
        // Keep only the last maxLogSize entries
        if (this.logs.length > this.maxLogSize) {
            this.logs = this.logs.slice(-this.maxLogSize);
        }

        // Console output with color coding
        const colorCode = this.getColorCode(type);
        const resetCode = '\x1b[0m';
        console.log(`${colorCode}${timestamp} ${prefix}${commandId ? ` [${commandId}]` : ''} ${message}${resetCode}`);
    }

    /**
     * Get color code for log type
     * @param {string} type - Log type
     * @returns {string} - ANSI color code
     */
    getColorCode(type) {
        const colors = {
            stdout: '\x1b[32m', // Green
            stderr: '\x1b[33m', // Yellow
            error: '\x1b[31m',  // Red
            timeout: '\x1b[35m', // Magenta
            info: '\x1b[36m',   // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m'  // Yellow
        };
        return colors[type] || '\x1b[0m';
    }

    /**
     * Get recent logs
     * @param {number} count - Number of recent logs to return
     * @returns {Array} - Recent log entries
     */
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    /**
     * Get logs for a specific command
     * @param {string} commandId - Command ID
     * @returns {Array} - Log entries for the command
     */
    getCommandLogs(commandId) {
        return this.logs.filter(log => log.commandId === commandId);
    }

    /**
     * Save logs to file
     * @param {string} filePath - Path to save logs
     */
    async saveLogs(filePath) {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                logs: this.logs,
                runningProcesses: Array.from(this.runningProcesses.keys())
            };
            
            await fs.promises.writeFile(filePath, JSON.stringify(logData, null, 2));
            this.log(`💾 Logs saved to ${filePath}`);
        } catch (error) {
            this.log(`❌ Error saving logs: ${error.message}`, '[ERROR]');
        }
    }

    /**
     * Get status of all running processes
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            runningProcesses: this.runningProcesses.size,
            totalLogs: this.logs.length,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }
}

// Export singleton instance
module.exports = new ProcessManager();
