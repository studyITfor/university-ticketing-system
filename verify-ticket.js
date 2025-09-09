const axios = require('axios');
const readline = require('readline');

class TicketVerifier {
    constructor(serverUrl = 'http://localhost:3000') {
        this.serverUrl = serverUrl;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * Display welcome message and instructions
     */
    displayWelcome() {
        console.log('🎫 Event Ticket Verifier');
        console.log('========================\n');
        console.log('This tool verifies secure QR tickets for events.');
        console.log('You can:');
        console.log('• Paste a QR code string directly');
        console.log('• Type "exit" to quit');
        console.log('• Type "help" for more options\n');
    }

    /**
     * Display help information
     */
    displayHelp() {
        console.log('\n📖 Help - Available Commands:');
        console.log('• Paste QR code string - Verify a ticket');
        console.log('• "exit" or "quit" - Exit the program');
        console.log('• "help" - Show this help message');
        console.log('• "status" - Check server connection');
        console.log('• "clear" - Clear the screen\n');
    }

    /**
     * Check server connection status
     */
    async checkServerStatus() {
        try {
            console.log('🔍 Checking server connection...');
            // Try a simple verification request instead of stats
            const response = await axios.post(`${this.serverUrl}/api/secure-tickets/verify`, {
                qrCodeData: 'test-connection'
            }, {
                timeout: 5000
            });
            
            // Even if verification fails, server is responding
            console.log('✅ Server is online and responding');
            return true;
        } catch (error) {
            if (error.response && error.response.status !== 404) {
                // Server is responding but with an error
                console.log('✅ Server is online and responding');
                return true;
            } else {
                console.log('❌ Server is unreachable or not responding');
                console.log(`📄 Error: ${error.message}`);
                return false;
            }
        }
    }

    /**
     * Verify a ticket using the secure ticket system
     */
    async verifyTicket(qrCodeData) {
        try {
            console.log('🔍 Verifying ticket...');
            
            const response = await axios.post(`${this.serverUrl}/api/secure-tickets/verify`, {
                qrCodeData: qrCodeData
            }, {
                timeout: 10000
            });

            if (response.data.success) {
                this.displayValidTicket(response.data.data);
                return true;
            } else {
                this.displayInvalidTicket(response.data.error, response.data.data);
                return false;
            }
        } catch (error) {
            this.displayError(error);
            return false;
        }
    }

    /**
     * Display valid ticket information
     */
    displayValidTicket(ticketData) {
        console.log('\n✅ TICKET VERIFIED SUCCESSFULLY!');
        console.log('================================');
        console.log(`🎫 Ticket ID: ${ticketData.ticketId}`);
        console.log(`👤 Holder Name: ${ticketData.holderName}`);
        console.log(`🪑 Seat: Table ${ticketData.table}, Seat ${ticketData.seat}`);
        console.log(`📊 Status: ${ticketData.valid ? 'Valid' : 'Invalid'}`);
        console.log(`🔢 Verification Count: ${ticketData.verificationCount || 0}`);
        
        if (ticketData.eventInfo) {
            console.log('\n🎪 Event Information:');
            console.log(`📅 Event: ${ticketData.eventInfo.name}`);
            console.log(`📅 Date: ${ticketData.eventInfo.date}`);
            console.log(`⏰ Time: ${ticketData.eventInfo.time}`);
            console.log(`📍 Venue: ${ticketData.eventInfo.venue}`);
        }
        
        console.log(`\n💬 Message: ${ticketData.message}`);
        console.log('================================\n');
    }

    /**
     * Display invalid ticket information
     */
    displayInvalidTicket(error, ticketData) {
        console.log('\n❌ TICKET VERIFICATION FAILED!');
        console.log('==============================');
        console.log(`🚫 Error: ${error}`);
        
        if (ticketData && ticketData.message) {
            console.log(`💬 Message: ${ticketData.message}`);
        }
        
        console.log('\nPossible reasons:');
        console.log('• QR code is damaged or corrupted');
        console.log('• Ticket has already been used');
        console.log('• Ticket is not in the database');
        console.log('• QR code data is invalid or tampered with');
        console.log('==============================\n');
    }

    /**
     * Display error information
     */
    displayError(error) {
        console.log('\n❌ ERROR OCCURRED!');
        console.log('==================');
        
        if (error.code === 'ECONNREFUSED') {
            console.log('🚫 Cannot connect to the server');
            console.log('💡 Make sure the server is running on http://localhost:3000');
        } else if (error.code === 'ENOTFOUND') {
            console.log('🚫 Server not found');
            console.log('💡 Check the server URL and network connection');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('⏰ Request timed out');
            console.log('💡 Server might be overloaded, try again');
        } else if (error.response) {
            console.log(`🚫 Server Error: ${error.response.status}`);
            console.log(`📄 Message: ${error.response.data?.error || 'Unknown error'}`);
        } else {
            console.log(`📄 Error: ${error.message}`);
        }
        
        console.log('==================\n');
    }

    /**
     * Clear the screen
     */
    clearScreen() {
        console.clear();
        this.displayWelcome();
    }

    /**
     * Process user input
     */
    async processInput(input) {
        const trimmedInput = input.trim();
        
        if (!trimmedInput) {
            console.log('⚠️ Please enter a QR code string or command\n');
            return;
        }

        // Handle commands
        if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
            console.log('👋 Goodbye!');
            this.rl.close();
            process.exit(0);
        } else if (trimmedInput.toLowerCase() === 'help') {
            this.displayHelp();
        } else if (trimmedInput.toLowerCase() === 'status') {
            await this.checkServerStatus();
        } else if (trimmedInput.toLowerCase() === 'clear') {
            this.clearScreen();
        } else {
            // Treat as QR code data
            await this.verifyTicket(trimmedInput);
        }
    }

    /**
     * Start the interactive ticket verifier
     */
    async start() {
        this.displayWelcome();
        
        // Check server status on startup
        const serverOnline = await this.checkServerStatus();
        if (!serverOnline) {
            console.log('⚠️ Warning: Server appears to be offline. Some features may not work.\n');
        }

        // Check if stdin is a TTY (interactive terminal)
        if (process.stdin.isTTY) {
            // Start the interactive loop
            const askForInput = () => {
                this.rl.question('🔍 Enter QR code string or command: ', async (input) => {
                    await this.processInput(input);
                    askForInput(); // Continue the loop
                });
            };

            askForInput();
        } else {
            // Non-interactive mode - read from stdin
            let input = '';
            process.stdin.on('data', (chunk) => {
                input += chunk.toString();
            });
            
            process.stdin.on('end', async () => {
                const lines = input.trim().split('\n');
                for (const line of lines) {
                    if (line.trim()) {
                        await this.processInput(line.trim());
                    }
                }
                process.exit(0);
            });
        }
    }

    /**
     * Verify a single ticket (non-interactive mode)
     */
    async verifySingleTicket(qrCodeData) {
        console.log('🎫 Event Ticket Verifier (Single Mode)');
        console.log('=====================================\n');
        
        const serverOnline = await this.checkServerStatus();
        if (!serverOnline) {
            console.log('❌ Cannot verify ticket - server is offline');
            process.exit(1);
        }

        await this.verifyTicket(qrCodeData);
        process.exit(0);
    }
}

// Main execution
async function main() {
    const verifier = new TicketVerifier();
    
    // Check if QR code data was provided as command line argument
    const qrCodeData = process.argv[2];
    
    if (qrCodeData) {
        // Non-interactive mode - verify single ticket
        await verifier.verifySingleTicket(qrCodeData);
    } else {
        // Interactive mode
        await verifier.start();
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
});

// Run the main function
main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
