const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class TicketVerifierWeb {
    constructor(port = 3001, secureServerUrl = 'http://localhost:3000') {
        this.app = express();
        this.port = port;
        this.secureServerUrl = secureServerUrl;
        this.oldTicketsFile = './old-tickets.json';
        this.verificationLogFile = './verification-log.json';
        
        // Load old tickets database
        this.oldTickets = this.loadOldTickets();
        this.verificationLog = this.loadVerificationLog();
        
        // Secure ticket system configuration
        this.secureTicketSecret = 'default-secret-key-change-in-production';
        this.algorithm = 'aes-256-cbc';
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static('public'));
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
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
     * Load verification log
     */
    loadVerificationLog() {
        try {
            if (fs.existsSync(this.verificationLogFile)) {
                const data = fs.readFileSync(this.verificationLogFile, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading verification log:', error.message);
        }
        return {
            verifications: [],
            stats: {
                total: 0,
                valid: 0,
                used: 0,
                invalid: 0,
                errors: 0
            }
        };
    }

    /**
     * Save verification log
     */
    saveVerificationLog() {
        try {
            fs.writeFileSync(this.verificationLogFile, JSON.stringify(this.verificationLog, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving verification log:', error.message);
            return false;
        }
    }

    /**
     * Log verification attempt
     */
    logVerification(ticketData, result) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ticketData: ticketData,
            result: result,
            ip: 'unknown' // In production, get from req.ip
        };
        
        this.verificationLog.verifications.unshift(logEntry);
        
        // Keep only last 1000 entries
        if (this.verificationLog.verifications.length > 1000) {
            this.verificationLog.verifications = this.verificationLog.verifications.slice(0, 1000);
        }
        
        // Update stats
        this.verificationLog.stats.total++;
        if (result.success) {
            this.verificationLog.stats.valid++;
        } else if (result.error && result.error.includes('used')) {
            this.verificationLog.stats.used++;
        } else if (result.error && result.error.includes('not found')) {
            this.verificationLog.stats.invalid++;
        } else {
            this.verificationLog.stats.errors++;
        }
        
        this.saveVerificationLog();
    }

    /**
     * Detect ticket type
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
     * Verify secure QR ticket via server API
     */
    async verifySecureQRTicket(qrCodeData) {
        try {
            const response = await axios.post(`${this.secureServerUrl}/api/secure-tickets/verify`, {
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
            const response = await axios.post(`${this.secureServerUrl}/api/secure-tickets/verify-by-id`, {
                ticketId: ticketId
            }, {
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
                    error: response.data.error || 'Ticket not found'
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

        // Log the verification
        this.logVerification(input, result);

        return result;
    }

    /**
     * Mark ticket as used
     */
    async markTicketAsUsed(ticketType, ticketId, usedBy = 'web-verifier') {
        try {
            if (ticketType === 'secure_qr' || ticketType === 'ticket_id') {
                // Mark secure ticket as used via server
                const response = await axios.post(`${this.secureServerUrl}/api/secure-tickets/mark-used`, {
                    ticketId: ticketId,
                    usedBy: usedBy
                });
                
                if (response.data.success) {
                    return { success: true, message: 'Secure ticket marked as used' };
                } else {
                    return { success: false, error: response.data.error };
                }
            } else if (ticketType === 'numeric') {
                // Mark old ticket as used locally
                if (this.oldTickets[ticketId]) {
                    this.oldTickets[ticketId].status = 'used';
                    this.oldTickets[ticketId].usedAt = new Date().toISOString();
                    this.oldTickets[ticketId].usedBy = usedBy;
                    this.saveOldTickets();
                    return { success: true, message: 'Numeric ticket marked as used' };
                } else {
                    return { success: false, error: 'Numeric ticket not found' };
                }
            }
        } catch (error) {
            return { success: false, error: 'Error marking ticket as used: ' + error.message };
        }
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Serve the main page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Verify ticket endpoint
        this.app.post('/api/verify', async (req, res) => {
            try {
                const { ticketData } = req.body;
                
                if (!ticketData) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ticket data is required'
                    });
                }

                const result = await this.verifyTicket(ticketData);
                res.json(result);
            } catch (error) {
                console.error('Error verifying ticket:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error: ' + error.message
                });
            }
        });

        // Mark ticket as used endpoint
        this.app.post('/api/mark-used', async (req, res) => {
            try {
                const { ticketType, ticketId, usedBy } = req.body;
                
                if (!ticketType || !ticketId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ticket type and ID are required'
                    });
                }

                const result = await this.markTicketAsUsed(ticketType, ticketId, usedBy);
                res.json(result);
            } catch (error) {
                console.error('Error marking ticket as used:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error: ' + error.message
                });
            }
        });

        // Get verification log endpoint
        this.app.get('/api/log', (req, res) => {
            try {
                const { limit = 50, offset = 0 } = req.query;
                const verifications = this.verificationLog.verifications.slice(
                    parseInt(offset), 
                    parseInt(offset) + parseInt(limit)
                );
                
                res.json({
                    success: true,
                    data: {
                        verifications: verifications,
                        stats: this.verificationLog.stats,
                        total: this.verificationLog.verifications.length
                    }
                });
            } catch (error) {
                console.error('Error getting verification log:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error: ' + error.message
                });
            }
        });

        // Get stats endpoint
        this.app.get('/api/stats', (req, res) => {
            try {
                res.json({
                    success: true,
                    data: this.verificationLog.stats
                });
            } catch (error) {
                console.error('Error getting stats:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error: ' + error.message
                });
            }
        });

        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                message: 'Ticket Verifier Web is running',
                timestamp: new Date().toISOString(),
                stats: this.verificationLog.stats
            });
        });

        // Get seat statuses endpoint for real-time synchronization
        this.app.get('/api/seat-statuses', async (req, res) => {
            try {
                const seatStatuses = [];
                
                // Initialize all seats as available (35 tables, 6 seats each = 210 seats)
                for (let table = 1; table <= 35; table++) {
                    for (let seat = 1; seat <= 6; seat++) {
                        seatStatuses.push({
                            table: table,
                            seat: seat,
                            status: 'available'
                        });
                    }
                }
                
                // Load secure tickets database to check for booked seats
                const secureTicketsFile = './secure-tickets-database.json';
                if (fs.existsSync(secureTicketsFile)) {
                    const secureTicketsData = JSON.parse(fs.readFileSync(secureTicketsFile, 'utf8'));
                    
                    // Update seat statuses based on secure tickets
                    Object.values(secureTicketsData).forEach(ticket => {
                        if (ticket.table && ticket.seat) {
                            const seatIndex = (ticket.table - 1) * 6 + (ticket.seat - 1);
                            if (seatIndex >= 0 && seatIndex < seatStatuses.length) {
                                let status = 'available';
                                
                                if (ticket.status === 'used' || ticket.status === 'confirmed') {
                                    status = 'reserved';
                                } else if (ticket.status === 'pending' || ticket.status === 'generated') {
                                    status = 'pending';
                                }
                                
                                seatStatuses[seatIndex] = {
                                    table: ticket.table,
                                    seat: ticket.seat,
                                    status: status,
                                    ticketId: ticket.ticketId
                                };
                            }
                        }
                    });
                }
                
                res.json({
                    success: true,
                    data: seatStatuses
                });
            } catch (error) {
                console.error('Error getting seat statuses:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to get seat statuses: ' + error.message
                });
            }
        });
    }

    /**
     * Start the web server
     */
    start() {
        this.app.listen(this.port, () => {
            console.log('🎫 Ticket Verifier Web Server');
            console.log('=============================');
            console.log(`🌐 Server running on http://localhost:${this.port}`);
            console.log(`📊 Admin panel: http://localhost:${this.port}`);
            console.log(`🔍 Health check: http://localhost:${this.port}/api/health`);
            console.log(`📈 Stats: http://localhost:${this.port}/api/stats`);
            console.log(`📋 Log: http://localhost:${this.port}/api/log`);
            console.log('');
            console.log('✅ Ready to verify tickets!');
        });
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const verifier = new TicketVerifierWeb();
    verifier.start();
}

module.exports = TicketVerifierWeb;
