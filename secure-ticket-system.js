const crypto = require('crypto');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');

class SecureTicketSystem {
    constructor(secretKey, ticketsFilePath = './tickets-database.json') {
        this.secretKey = secretKey || this.generateSecretKey();
        this.ticketsFilePath = ticketsFilePath;
        this.ticketsDatabase = this.loadTicketsDatabase();
        this.algorithm = 'aes-256-gcm';
        
        console.log('🔐 Secure Ticket System initialized');
        console.log(`📁 Tickets database: ${this.ticketsFilePath}`);
    }

    /**
     * Generate a secure secret key for encryption
     */
    generateSecretKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Load tickets database from file
     */
    loadTicketsDatabase() {
        try {
            if (fs.existsSync(this.ticketsFilePath)) {
                const data = fs.readFileSync(this.ticketsFilePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading tickets database:', error);
        }
        return {};
    }

    /**
     * Save tickets database to file
     */
    saveTicketsDatabase() {
        try {
            fs.writeFileSync(this.ticketsFilePath, JSON.stringify(this.ticketsDatabase, null, 2));
            return true;
        } catch (error) {
            console.error('Error saving tickets database:', error);
            return false;
        }
    }

    /**
     * Encrypt ticket data
     */
    encryptTicketData(ticketData) {
        try {
            const iv = crypto.randomBytes(16);
            const key = crypto.scryptSync(this.secretKey, 'salt', 32);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            
            let encrypted = cipher.update(JSON.stringify(ticketData), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Create authentication tag
            const authTag = crypto.createHash('sha256')
                .update(encrypted + iv.toString('hex') + this.secretKey)
                .digest('hex');
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag
            };
        } catch (error) {
            console.error('Error encrypting ticket data:', error);
            throw error;
        }
    }

    /**
     * Decrypt ticket data
     */
    decryptTicketData(encryptedData) {
        try {
            const key = crypto.scryptSync(this.secretKey, 'salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(encryptedData.iv, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            // Verify authentication tag
            const expectedAuthTag = crypto.createHash('sha256')
                .update(encryptedData.encrypted + encryptedData.iv + this.secretKey)
                .digest('hex');
            
            if (expectedAuthTag !== encryptedData.authTag) {
                throw new Error('Authentication tag verification failed');
            }
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Error decrypting ticket data:', error);
            throw new Error('Invalid or corrupted ticket data');
        }
    }

    /**
     * Generate a secure QR code for a ticket
     */
    async generateSecureQRCode(ticketData) {
        try {
            console.log('🎫 Generating secure QR code for ticket:', ticketData.ticketId);
            
            // Add timestamp and security metadata
            const secureTicketData = {
                ...ticketData,
                generatedAt: new Date().toISOString(),
                version: '1.0',
                checksum: this.generateChecksum(ticketData)
            };

            // Encrypt the ticket data
            const encryptedData = this.encryptTicketData(secureTicketData);
            
            // Generate QR code as base64 string
            const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(encryptedData), {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'H' // High error correction for security
            });

            console.log('✅ Secure QR code generated successfully');
            return {
                qrCodeDataURL: qrCodeDataURL,
                qrCodeData: JSON.stringify(encryptedData) // Return the encrypted data for verification
            };
        } catch (error) {
            console.error('Error generating secure QR code:', error);
            throw error;
        }
    }

    /**
     * Generate checksum for ticket data integrity
     */
    generateChecksum(ticketData) {
        const dataString = JSON.stringify({
            ticketId: ticketData.ticketId,
            holderName: ticketData.holderName,
            table: ticketData.table,
            seat: ticketData.seat,
            eventId: ticketData.eventId
        });
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Verify checksum
     */
    verifyChecksum(ticketData, providedChecksum) {
        const expectedChecksum = this.generateChecksum(ticketData);
        return crypto.timingSafeEqual(
            Buffer.from(expectedChecksum, 'hex'),
            Buffer.from(providedChecksum, 'hex')
        );
    }

    /**
     * Create a new secure ticket
     */
    async createSecureTicket(ticketInfo) {
        try {
            const ticketId = ticketInfo.ticketId || this.generateTicketId();
            
            const ticketData = {
                ticketId: ticketId,
                holderName: ticketInfo.holderName,
                table: ticketInfo.table,
                seat: ticketInfo.seat,
                eventId: ticketInfo.eventId || 'GOLDENMIDDLE-2025',
                eventName: ticketInfo.eventName || 'GOLDENMIDDLE',
                eventDate: ticketInfo.eventDate || '2025-10-26',
                eventTime: ticketInfo.eventTime || '18:00',
                eventVenue: ticketInfo.eventVenue || 'Асман',
                price: ticketInfo.price || 5900,
                currency: ticketInfo.currency || 'Сом',
                createdBy: ticketInfo.createdBy || 'system',
                createdAt: new Date().toISOString(),
                status: 'active' // active, used, cancelled
            };

            // Store ticket in database
            this.ticketsDatabase[ticketId] = {
                ...ticketData,
                usedAt: null,
                usedBy: null,
                verificationCount: 0
            };

            // Save database
            this.saveTicketsDatabase();

            // Generate QR code
            const qrCodeResult = await this.generateSecureQRCode(ticketData);

            console.log('✅ Secure ticket created:', ticketId);
            return {
                ticketId: ticketId,
                qrCodeDataURL: qrCodeResult.qrCodeDataURL,
                qrCodeData: qrCodeResult.qrCodeData,
                ticketData: ticketData
            };
        } catch (error) {
            console.error('Error creating secure ticket:', error);
            throw error;
        }
    }

    /**
     * Generate unique ticket ID
     */
    generateTicketId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TK${timestamp}${random}`;
    }

    /**
     * Auto-add missing ticket to database
     */
    async autoAddMissingTicket(ticketData) {
        try {
            console.log('🔄 Auto-adding missing ticket to database...');
            
            // Check if ticket already exists (prevent duplicates)
            if (this.ticketsDatabase[ticketData.ticketId]) {
                console.log('✅ Ticket already exists in database');
                return this.ticketsDatabase[ticketData.ticketId];
            }

            // Create new ticket entry with default values
            const newTicket = {
                ticketId: ticketData.ticketId,
                holderName: ticketData.holderName || 'Unknown Holder',
                table: ticketData.table || 1,
                seat: ticketData.seat || 1,
                eventId: ticketData.eventId || 'AUTO-ADDED-2025',
                eventName: ticketData.eventName || 'Auto-Added Event',
                eventDate: ticketData.eventDate || new Date().toISOString().split('T')[0],
                eventTime: ticketData.eventTime || '18:00',
                eventVenue: ticketData.eventVenue || 'Auto-Added Venue',
                price: ticketData.price || 5900,
                currency: ticketData.currency || 'Сом',
                createdBy: 'auto-add-system',
                createdAt: new Date().toISOString(),
                status: 'active',
                usedAt: null,
                usedBy: null,
                verificationCount: 0
            };

            // Add to database
            this.ticketsDatabase[ticketData.ticketId] = newTicket;
            this.saveTicketsDatabase();

            console.log('✅ Missing ticket auto-added successfully');
            console.log(`🎫 Ticket ID: ${newTicket.ticketId}`);
            console.log(`👤 Holder: ${newTicket.holderName}`);
            console.log(`🪑 Seat: Table ${newTicket.table}, Seat ${newTicket.seat}`);
            console.log(`📅 Event: ${newTicket.eventName} on ${newTicket.eventDate}`);

            return newTicket;
        } catch (error) {
            console.error('❌ Error auto-adding missing ticket:', error.message);
            throw new Error('Failed to auto-add missing ticket: ' + error.message);
        }
    }

    /**
     * Manually add a ticket to the database (for admin use)
     */
    async addTicketManually(ticketInfo) {
        try {
            console.log('🔄 Manually adding ticket to database...');
            
            // Validate required fields
            if (!ticketInfo.ticketId) {
                throw new Error('Ticket ID is required');
            }

            // Check if ticket already exists
            if (this.ticketsDatabase[ticketInfo.ticketId]) {
                throw new Error('Ticket with this ID already exists');
            }

            // Create new ticket entry
            const newTicket = {
                ticketId: ticketInfo.ticketId,
                holderName: ticketInfo.holderName || 'Unknown Holder',
                table: ticketInfo.table || 1,
                seat: ticketInfo.seat || 1,
                eventId: ticketInfo.eventId || 'MANUAL-ADD-2025',
                eventName: ticketInfo.eventName || 'Manual Event',
                eventDate: ticketInfo.eventDate || new Date().toISOString().split('T')[0],
                eventTime: ticketInfo.eventTime || '18:00',
                eventVenue: ticketInfo.eventVenue || 'Manual Venue',
                price: ticketInfo.price || 5900,
                currency: ticketInfo.currency || 'Сом',
                createdBy: ticketInfo.createdBy || 'manual-admin',
                createdAt: new Date().toISOString(),
                status: ticketInfo.status || 'active',
                usedAt: null,
                usedBy: null,
                verificationCount: 0
            };

            // Add to database
            this.ticketsDatabase[ticketInfo.ticketId] = newTicket;
            this.saveTicketsDatabase();

            console.log('✅ Ticket manually added successfully');
            console.log(`🎫 Ticket ID: ${newTicket.ticketId}`);
            console.log(`👤 Holder: ${newTicket.holderName}`);
            console.log(`🪑 Seat: Table ${newTicket.table}, Seat ${newTicket.seat}`);

            return newTicket;
        } catch (error) {
            console.error('❌ Error manually adding ticket:', error.message);
            throw error;
        }
    }

    /**
     * Check if a ticket exists in the database
     */
    ticketExists(ticketId) {
        return !!this.ticketsDatabase[ticketId];
    }

    /**
     * Get ticket by ID (for verification without QR code)
     */
    async verifyTicketById(ticketId) {
        try {
            console.log(`🔍 Verifying ticket by ID: ${ticketId}`);
            
            const storedTicket = this.ticketsDatabase[ticketId];
            if (!storedTicket) {
                throw new Error('Ticket not found in database');
            }

            // Check if ticket is still active
            if (storedTicket.status !== 'active') {
                throw new Error(`Ticket is ${storedTicket.status}`);
            }

            // Increment verification count
            storedTicket.verificationCount = (storedTicket.verificationCount || 0) + 1;
            this.saveTicketsDatabase();

            console.log('✅ Ticket verified successfully by ID');
            return {
                valid: true,
                ticket: storedTicket,
                message: 'Ticket verified successfully'
            };
        } catch (error) {
            console.error('❌ Ticket verification failed:', error.message);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Verify and decrypt a ticket from QR code data
     */
    async verifyTicket(qrCodeData) {
        try {
            console.log('🔍 Verifying ticket...');
            
            // Parse QR code data
            let encryptedData;
            try {
                encryptedData = JSON.parse(qrCodeData);
            } catch (error) {
                throw new Error('Invalid QR code format');
            }

            // Decrypt ticket data
            const ticketData = this.decryptTicketData(encryptedData);
            
            // Verify checksum
            if (!this.verifyChecksum(ticketData, ticketData.checksum)) {
                throw new Error('Ticket data integrity check failed');
            }

            // Check if ticket exists in database
            let storedTicket = this.ticketsDatabase[ticketData.ticketId];
            if (!storedTicket) {
                console.log('⚠️ Ticket not found in database, attempting to add...');
                storedTicket = await this.autoAddMissingTicket(ticketData);
            }

            // Check if ticket is still active
            if (storedTicket.status !== 'active') {
                throw new Error(`Ticket is ${storedTicket.status}`);
            }

            // Check if ticket has expired (optional - based on event date)
            const eventDate = new Date(ticketData.eventDate);
            const now = new Date();
            if (now > eventDate) {
                console.log('⚠️ Ticket event date has passed');
            }

            // Increment verification count
            storedTicket.verificationCount = (storedTicket.verificationCount || 0) + 1;
            this.saveTicketsDatabase();

            console.log('✅ Ticket verified successfully');
            return {
                valid: true,
                ticketId: ticketData.ticketId,
                holderName: ticketData.holderName,
                table: ticketData.table,
                seat: ticketData.seat,
                eventInfo: {
                    name: ticketData.eventName,
                    date: ticketData.eventDate,
                    time: ticketData.eventTime,
                    venue: ticketData.eventVenue
                },
                verificationCount: storedTicket.verificationCount,
                message: 'Ticket is valid and ready for entry'
            };
        } catch (error) {
            console.error('❌ Ticket verification failed:', error.message);
            return {
                valid: false,
                error: error.message,
                message: 'Ticket verification failed'
            };
        }
    }

    /**
     * Mark ticket as used
     */
    markTicketAsUsed(ticketId, usedBy = 'system') {
        try {
            const ticket = this.ticketsDatabase[ticketId];
            if (!ticket) {
                throw new Error('Ticket not found');
            }

            if (ticket.status !== 'active') {
                throw new Error(`Ticket is already ${ticket.status}`);
            }

            ticket.status = 'used';
            ticket.usedAt = new Date().toISOString();
            ticket.usedBy = usedBy;

            this.saveTicketsDatabase();
            console.log(`✅ Ticket ${ticketId} marked as used by ${usedBy}`);
            return true;
        } catch (error) {
            console.error('Error marking ticket as used:', error);
            throw error;
        }
    }

    /**
     * Get ticket information
     */
    getTicketInfo(ticketId) {
        return this.ticketsDatabase[ticketId] || null;
    }

    /**
     * Get all tickets (for admin purposes)
     */
    getAllTickets() {
        return this.ticketsDatabase;
    }

    /**
     * Get ticket statistics
     */
    getTicketStatistics() {
        const tickets = Object.values(this.ticketsDatabase);
        return {
            total: tickets.length,
            active: tickets.filter(t => t.status === 'active').length,
            used: tickets.filter(t => t.status === 'used').length,
            cancelled: tickets.filter(t => t.status === 'cancelled').length
        };
    }
}

module.exports = SecureTicketSystem;
