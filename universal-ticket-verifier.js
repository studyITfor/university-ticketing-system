const axios = require('axios');
const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class UniversalTicketVerifier {
    constructor(serverUrl = 'http://localhost:3000', oldTicketsFile = './old-tickets.json') {
        this.serverUrl = serverUrl;
        this.oldTicketsFile = oldTicketsFile;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Load old tickets database
        this.oldTickets = this.loadOldTickets();
        
        // Secure ticket system configuration
        this.secureTicketSecret = 'default-secret-key-change-in-production';
        this.algorithm = 'aes-256-cbc';
    }

    /**
     * Load old tickets from JSON file
     */
    loadOldTickets() {
        try {
            if (fs.existsSync(this.oldTicketsFile)) {
                const data = fs.readFileSync(this.oldTicketsFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading old tickets:', error.message);
        }
        return {};
    }

    /**
     * Save old tickets to JSON file
     */
    saveOldTickets() {
        try {
            fs.writeFileSync(this.oldTicketsFile, JSON.stringify(this.oldTickets, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving old tickets:', error.message);
            return false;
        }
    }

    /**
     * Detect if input is a secure QR code or old numeric ticket
     */
    detectTicketType(input) {
        const trimmedInput = input.trim();
        
        // Check if it's a numeric ticket ID (old format)
        if (/^\d+$/.test(trimmedInput)) {
            return 'numeric';
        }
        
        // Check if it's a secure QR code (JSON format with encrypted data)
        try {
            const parsed = JSON.parse(trimmedInput);
            if (parsed.encrypted && parsed.iv && parsed.authTag) {
                return 'secure_qr';
            }
        } catch (error) {
            // Not JSON, might be other format
        }
        
        // Check if it's a ticket ID format (TK...)
        if (/^TK[A-Z0-9]+$/.test(trimmedInput)) {
            return 'ticket_id';
        }
        
        return 'unknown';
    }

    /**
     * Decrypt secure QR code data
     */
    decryptSecureQRData(encryptedData) {
        try {
            const key = crypto.scryptSync(this.secureTicketSecret, 'salt', 32);
            const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(encryptedData.iv, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            // Verify authentication tag
            const expectedAuthTag = crypto.createHash('sha256')
                .update(encryptedData.encrypted + encryptedData.iv + this.secureTicketSecret)
                .digest('hex');
            
            if (expectedAuthTag !== encryptedData.authTag) {
                throw new Error('Authentication tag verification failed');
            }
            
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('Failed to decrypt secure QR data: ' + error.message);
        }
    }

    /**
     * Verify secure QR ticket via server API
     */
    async verifySecureQRTicket(qrCodeData) {
        try {
            console.log('🔐 Verifying secure QR ticket via server...');
            
            const response = await axios.post(`${this.serverUrl}/api/secure-tickets/verify`, {
                qrCodeData: qrCodeData
            }, {
                timeout: 10000
            });

            if (response.data.success) {
                return {
                    success: true,
                    type: 'secure_qr',
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    type: 'secure_qr',
                    error: response.data.error,
                    data: response.data.data
                };
            }
        } catch (error) {
            return {
                success: false,
                type: 'secure_qr',
                error: 'Server verification failed: ' + error.message
            };
        }
    }

    /**
     * Verify old numeric ticket
     */
    async verifyNumericTicket(ticketId) {
        try {
            console.log('🔢 Verifying numeric ticket...');
            
            const ticket = this.oldTickets[ticketId];
            if (!ticket) {
                return {
                    success: false,
                    type: 'numeric',
                    error: 'Ticket not found in database'
                };
            }

            if (ticket.status === 'used') {
                return {
                    success: false,
                    type: 'numeric',
                    error: 'Ticket has already been used',
                    data: ticket
                };
            }

            if (ticket.status === 'cancelled') {
                return {
                    success: false,
                    type: 'numeric',
                    error: 'Ticket has been cancelled',
                    data: ticket
                };
            }

            return {
                success: true,
                type: 'numeric',
                data: ticket
            };
        } catch (error) {
            return {
                success: false,
                type: 'numeric',
                error: 'Database error: ' + error.message
            };
        }
    }

    /**
     * Verify ticket by ID (for secure tickets)
     */
    async verifyTicketById(ticketId) {
        try {
            console.log('🎫 Verifying ticket by ID...');
            
            const response = await axios.get(`${this.serverUrl}/api/secure-tickets/${ticketId}`, {
                timeout: 10000
            });

            if (response.data.success) {
                const ticket = response.data.data;
                if (ticket.status === 'used') {
                    return {
                        success: false,
                        type: 'ticket_id',
                        error: 'Ticket has already been used',
                        data: ticket
                    };
                }

                return {
                    success: true,
                    type: 'ticket_id',
                    data: ticket
                };
            } else {
                return {
                    success: false,
                    type: 'ticket_id',
                    error: 'Ticket not found'
                };
            }
        } catch (error) {
            return {
                success: false,
                type: 'ticket_id',
                error: 'Server error: ' + error.message
            };
        }
    }

    /**
     * Mark ticket as used
     */
    async markTicketAsUsed(ticketType, ticketId, usedBy = 'verifier') {
        try {
            if (ticketType === 'secure_qr' || ticketType === 'ticket_id') {
                // Mark secure ticket as used via server
                const response = await axios.post(`${this.serverUrl}/api/secure-tickets/mark-used`, {
                    ticketId: ticketId,
                    usedBy: usedBy
                });
                
                if (response.data.success) {
                    console.log('✅ Secure ticket marked as used');
                    return true;
                } else {
                    console.log('❌ Failed to mark secure ticket as used:', response.data.error);
                    return false;
                }
            } else if (ticketType === 'numeric') {
                // Mark old ticket as used locally
                if (this.oldTickets[ticketId]) {
                    this.oldTickets[ticketId].status = 'used';
                    this.oldTickets[ticketId].usedAt = new Date().toISOString();
                    this.oldTickets[ticketId].usedBy = usedBy;
                    this.saveOldTickets();
                    console.log('✅ Numeric ticket marked as used');
                    return true;
                } else {
                    console.log('❌ Numeric ticket not found');
                    return false;
                }
            }
        } catch (error) {
            console.log('❌ Error marking ticket as used:', error.message);
            return false;
        }
    }

    /**
     * Verify any type of ticket
     */
    async verifyTicket(input) {
        const ticketType = this.detectTicketType(input);
        console.log(`🔍 Detected ticket type: ${ticketType}`);

        let result;

        switch (ticketType) {
            case 'secure_qr':
                result = await this.verifySecureQRTicket(input);
                break;
            case 'numeric':
                result = await this.verifyNumericTicket(input);
                break;
            case 'ticket_id':
                result = await this.verifyTicketById(input);
                break;
            default:
                result = {
                    success: false,
                    type: 'unknown',
                    error: 'Unknown ticket format. Please provide a valid QR code, numeric ticket ID, or ticket ID (TK...)'
                };
        }

        return result;
    }

    /**
     * Display verification result
     */
    displayResult(result) {
        if (result.success) {
            this.displayValidTicket(result);
        } else {
            this.displayInvalidTicket(result);
        }
    }

    /**
     * Display valid ticket information
     */
    displayValidTicket(result) {
        console.log('\n✅ TICKET VERIFIED SUCCESSFULLY!');
        console.log('================================');
        console.log(`🎫 Ticket Type: ${result.type.toUpperCase()}`);
        
        if (result.type === 'secure_qr') {
            console.log(`🎫 Ticket ID: ${result.data.ticketId}`);
            console.log(`👤 Holder Name: ${result.data.holderName}`);
            console.log(`🪑 Seat: Table ${result.data.table}, Seat ${result.data.seat}`);
            console.log(`📊 Status: ${result.data.valid ? 'Valid' : 'Invalid'}`);
            console.log(`🔢 Verification Count: ${result.data.verificationCount || 0}`);
            
            if (result.data.eventInfo) {
                console.log('\n🎪 Event Information:');
                console.log(`📅 Event: ${result.data.eventInfo.name}`);
                console.log(`📅 Date: ${result.data.eventInfo.date}`);
                console.log(`⏰ Time: ${result.data.eventInfo.time}`);
                console.log(`📍 Venue: ${result.data.eventInfo.venue}`);
            }
        } else if (result.type === 'numeric') {
            console.log(`🎫 Ticket ID: ${result.data.id}`);
            console.log(`👤 Holder Name: ${result.data.holderName}`);
            console.log(`🪑 Seat: Table ${result.data.table}, Seat ${result.data.seat}`);
            console.log(`📊 Status: ${result.data.status}`);
            console.log(`📅 Created: ${result.data.createdAt}`);
            
            if (result.data.eventInfo) {
                console.log('\n🎪 Event Information:');
                console.log(`📅 Event: ${result.data.eventInfo.name}`);
                console.log(`📅 Date: ${result.data.eventInfo.date}`);
                console.log(`⏰ Time: ${result.data.eventInfo.time}`);
                console.log(`📍 Venue: ${result.data.eventInfo.venue}`);
            }
        } else if (result.type === 'ticket_id') {
            console.log(`🎫 Ticket ID: ${result.data.ticketId}`);
            console.log(`👤 Holder Name: ${result.data.holderName}`);
            console.log(`🪑 Seat: Table ${result.data.table}, Seat ${result.data.seat}`);
            console.log(`📊 Status: ${result.data.status}`);
            console.log(`📅 Created: ${result.data.createdAt}`);
        }
        
        if (result.data.message) {
            console.log(`\n💬 Message: ${result.data.message}`);
        }
        console.log('================================\n');
    }

    /**
     * Display invalid ticket information
     */
    displayInvalidTicket(result) {
        console.log('\n❌ TICKET VERIFICATION FAILED!');
        console.log('==============================');
        console.log(`🎫 Ticket Type: ${result.type.toUpperCase()}`);
        console.log(`🚫 Error: ${result.error}`);
        
        if (result.data && result.data.message) {
            console.log(`💬 Message: ${result.data.message}`);
        }
        
        console.log('\nPossible reasons:');
        if (result.type === 'secure_qr') {
            console.log('• QR code is damaged or corrupted');
            console.log('• Ticket has already been used');
            console.log('• Server is unreachable');
            console.log('• QR code data is invalid or tampered with');
        } else if (result.type === 'numeric') {
            console.log('• Ticket ID not found in database');
            console.log('• Ticket has already been used');
            console.log('• Ticket has been cancelled');
            console.log('• Database file is missing or corrupted');
        } else if (result.type === 'ticket_id') {
            console.log('• Ticket ID not found on server');
            console.log('• Ticket has already been used');
            console.log('• Server is unreachable');
        } else {
            console.log('• Invalid ticket format');
            console.log('• QR code is damaged');
            console.log('• Ticket ID is malformed');
        }
        console.log('==============================\n');
    }

    /**
     * Check server status
     */
    async checkServerStatus() {
        try {
            console.log('🔍 Checking server connection...');
            const response = await axios.get(`${this.serverUrl}/api/secure-tickets/stats`, {
                timeout: 5000
            });
            
            if (response.data.success) {
                console.log('✅ Server is online and responding');
                console.log(`📊 Secure Ticket Statistics:`, response.data.data);
            } else {
                console.log('⚠️ Server responded but with an error');
            }
        } catch (error) {
            if (error.response && error.response.status !== 404) {
                console.log('✅ Server is online and responding');
            } else {
                console.log('❌ Server is unreachable or not responding');
                console.log(`📄 Error: ${error.message}`);
            }
        }

        // Check old tickets database
        const oldTicketsCount = Object.keys(this.oldTickets).length;
        console.log(`📊 Old Tickets in Database: ${oldTicketsCount}`);
    }

    /**
     * Display help information
     */
    displayHelp() {
        console.log('\n📖 Help - Universal Ticket Verifier');
        console.log('====================================');
        console.log('This tool verifies both secure QR tickets and old numeric tickets.');
        console.log('\nSupported Ticket Types:');
        console.log('• Secure QR Codes - Encrypted JSON format from new system');
        console.log('• Numeric Tickets - Old format (numbers only)');
        console.log('• Ticket IDs - Secure ticket IDs (TK...)');
        console.log('\nAvailable Commands:');
        console.log('• Paste ticket data - Verify any type of ticket');
        console.log('• "mark" - Mark last verified ticket as used');
        console.log('• "status" - Check server and database status');
        console.log('• "help" - Show this help message');
        console.log('• "clear" - Clear the screen');
        console.log('• "exit" or "quit" - Exit the program');
        console.log('\nExamples:');
        console.log('• Secure QR: {"encrypted":"...","iv":"...","authTag":"..."}');
        console.log('• Numeric: 12345');
        console.log('• Ticket ID: TK1234567890ABCDEF');
        console.log('====================================\n');
    }

    /**
     * Clear the screen
     */
    clearScreen() {
        console.clear();
        this.displayWelcome();
    }

    /**
     * Display welcome message
     */
    displayWelcome() {
        console.log('🎫 Universal Ticket Verifier');
        console.log('============================');
        console.log('Supports: Secure QR Codes | Numeric Tickets | Ticket IDs');
        console.log('Type "help" for more information or paste a ticket to verify.\n');
    }

    /**
     * Process user input
     */
    async processInput(input) {
        const trimmedInput = input.trim();
        
        if (!trimmedInput) {
            console.log('⚠️ Please enter a ticket or command\n');
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
        } else if (trimmedInput.toLowerCase() === 'mark') {
            console.log('❌ No ticket to mark. Please verify a ticket first.\n');
        } else {
            // Treat as ticket data
            const result = await this.verifyTicket(trimmedInput);
            this.displayResult(result);
            
            // Store last result for marking
            this.lastResult = result;
        }
    }

    /**
     * Start the interactive verifier
     */
    async start() {
        this.displayWelcome();
        
        // Check status on startup
        await this.checkServerStatus();
        console.log('');

        // Check if stdin is a TTY (interactive terminal)
        if (process.stdin.isTTY) {
            // Start the interactive loop
            const askForInput = () => {
                this.rl.question('🔍 Enter ticket or command: ', async (input) => {
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
    async verifySingleTicket(ticketData) {
        console.log('🎫 Universal Ticket Verifier (Single Mode)');
        console.log('==========================================\n');
        
        const result = await this.verifyTicket(ticketData);
        this.displayResult(result);
        
        if (result.success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    const verifier = new UniversalTicketVerifier();
    
    // Check if ticket data was provided as command line argument
    const ticketData = process.argv[2];
    
    if (ticketData) {
        // Non-interactive mode - verify single ticket
        await verifier.verifySingleTicket(ticketData);
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
