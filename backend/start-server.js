#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

// Function to check if port is in use
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => {
                resolve(false);
            });
            server.close();
        });
        server.on('error', () => {
            resolve(true);
        });
    });
}

// Function to kill process on port
function killProcessOnPort(port) {
    return new Promise((resolve) => {
        const { exec } = require('child_process');
        exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
            if (error) {
                console.log('No process found on port', port);
                resolve();
                return;
            }
            
            const lines = stdout.trim().split('\n');
            const pids = new Set();
            
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const pid = parts[4];
                    if (pid && pid !== '0') {
                        pids.add(pid);
                    }
                }
            });
            
            if (pids.size === 0) {
                console.log('No process found on port', port);
                resolve();
                return;
            }
            
            console.log(`Found ${pids.size} process(es) on port ${port}:`, Array.from(pids));
            
            pids.forEach(pid => {
                exec(`taskkill /PID ${pid} /F`, (error) => {
                    if (error) {
                        console.log(`Failed to kill process ${pid}:`, error.message);
                    } else {
                        console.log(`Killed process ${pid}`);
                    }
                });
            });
            
            setTimeout(resolve, 2000); // Wait 2 seconds for processes to be killed
        });
    });
}

// Main function
async function startServer() {
    const port = 3000;
    
    console.log('🔍 Checking if port 3000 is in use...');
    
    const portInUse = await isPortInUse(port);
    
    if (portInUse) {
        console.log('⚠️ Port 3000 is in use. Attempting to free it...');
        await killProcessOnPort(port);
        
        // Check again after killing processes
        const stillInUse = await isPortInUse(port);
        if (stillInUse) {
            console.log('❌ Could not free port 3000. Please manually stop the process using this port.');
            console.log('💡 You can try:');
            console.log('   1. Open Task Manager and end Node.js processes');
            console.log('   2. Run: taskkill /F /IM node.exe');
            console.log('   3. Or change the port in config.js');
            process.exit(1);
        } else {
            console.log('✅ Port 3000 is now free');
        }
    } else {
        console.log('✅ Port 3000 is available');
    }
    
    console.log('🚀 Starting server...');
    
    // Start the server
    const server = spawn('node', ['server.js'], {
        stdio: 'inherit',
        shell: true
    });
    
    server.on('error', (error) => {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    });
    
    server.on('close', (code) => {
        console.log(`📊 Server process exited with code ${code}`);
    });
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n🛑 Stopping server...');
        server.kill('SIGINT');
        process.exit(0);
    });
}

// Run the script
startServer().catch(console.error);
