// Database Service Module
// Handles all database operations with proper transaction support and error handling

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseService {
    constructor() {
        this.pool = null;
        this.isConnected = false;
        this.init();
    }

    async init() {
        try {
            if (process.env.DATABASE_URL) {
                this.pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                });

                // Test connection
                const client = await this.pool.connect();
                await client.query('SELECT NOW()');
                client.release();
                
                this.isConnected = true;
                console.log('✅ Database service initialized successfully');
            } else {
                console.log('⚠️ DATABASE_URL not set - using mock database service');
                this.isConnected = false;
            }
        } catch (error) {
            console.error('❌ Database service initialization failed:', error);
            this.isConnected = false;
        }
    }

    // Generic query method with error handling
    async query(text, params = []) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            console.log('📊 Query executed:', { text: text.substring(0, 100), duration: `${duration}ms`, rows: result.rowCount });
            return result;
        } catch (error) {
            console.error('❌ Database query error:', { text: text.substring(0, 100), error: error.message });
            throw error;
        }
    }

    // Transaction wrapper
    async transaction(callback) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Transaction rolled back:', error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    // User operations
    async createOrUpdateUser(userData) {
        const { phone, firstName, lastName, email, role = 'user' } = userData;
        
        return await this.query(`
            INSERT INTO users (phone, first_name, last_name, email, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (phone) 
            DO UPDATE SET 
                first_name = COALESCE(EXCLUDED.first_name, users.first_name),
                last_name = COALESCE(EXCLUDED.last_name, users.last_name),
                email = COALESCE(EXCLUDED.email, users.email),
                role = COALESCE(EXCLUDED.role, users.role),
                updated_at = NOW()
            RETURNING *
        `, [phone, firstName, lastName, email, role]);
    }

    async getUserByPhone(phone) {
        const result = await this.query('SELECT * FROM users WHERE phone = $1', [phone]);
        return result.rows[0] || null;
    }

    // Booking operations
    async createBooking(bookingData) {
        return await this.transaction(async (client) => {
            // First, ensure user exists
            const userResult = await client.query(`
                INSERT INTO users (phone, first_name, last_name, role)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (phone) 
                DO UPDATE SET 
                    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
                    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
                    updated_at = NOW()
                RETURNING *
            `, [bookingData.phone, bookingData.firstName, bookingData.lastName, 'user']);

            const user = userResult.rows[0];

            // Create booking
            const bookingResult = await client.query(`
                INSERT INTO bookings (
                    booking_string_id, user_id, user_phone, event_id, table_number, seat_number, seat,
                    first_name, last_name, booking_status, status, price, whatsapp_optin,
                    confirmation_code, ip_address, user_agent, source
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *
            `, [
                bookingData.bookingId,
                user.id,
                bookingData.phone,
                bookingData.eventId || 1,
                bookingData.table,
                bookingData.seat,
                `${bookingData.table}-${bookingData.seat}`,
                bookingData.firstName,
                bookingData.lastName,
                'selected',
                'pending',
                bookingData.price || 5500.00,
                bookingData.whatsappOptin || false,
                bookingData.confirmationCode,
                bookingData.ipAddress,
                bookingData.userAgent,
                bookingData.source || 'web'
            ]);

            const booking = bookingResult.rows[0];

            // Log admin action
            await client.query(`
                INSERT INTO admin_actions (admin_user_id, action_type, target_booking_id, details, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                user.id,
                'booking_created',
                booking.id,
                JSON.stringify({ bookingId: booking.booking_string_id, table: booking.table_number, seat: booking.seat_number }),
                bookingData.ipAddress,
                bookingData.userAgent
            ]);

            return { booking, user };
        });
    }

    async updateBookingStatus(bookingId, status, adminData = {}) {
        return await this.transaction(async (client) => {
            // Update booking status
            const bookingResult = await client.query(`
                UPDATE bookings 
                SET booking_status = $1, 
                    status = $2,
                    payment_confirmed_by_admin = $3,
                    admin_confirmed_by = $4,
                    admin_notes = $5,
                    confirmed_at = CASE WHEN $1 = 'booked_paid' THEN NOW() ELSE confirmed_at END,
                    updated_at = NOW()
                WHERE id = $6 OR booking_string_id = $6
                RETURNING *
            `, [
                status,
                status === 'booked_paid' ? 'confirmed' : 'pending',
                status === 'booked_paid',
                adminData.adminId || 'admin',
                adminData.adminNotes || '',
                bookingId
            ]);

            if (bookingResult.rows.length === 0) {
                throw new Error('Booking not found');
            }

            const booking = bookingResult.rows[0];

            // Log admin action
            await client.query(`
                INSERT INTO admin_actions (admin_user_id, action_type, target_booking_id, details, ip_address, user_agent)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                adminData.adminUserId || null,
                'booking_status_updated',
                booking.id,
                JSON.stringify({ 
                    oldStatus: booking.booking_status, 
                    newStatus: status,
                    adminId: adminData.adminId 
                }),
                adminData.ipAddress,
                adminData.userAgent
            ]);

            return booking;
        });
    }

    async getBookingById(bookingId) {
        const result = await this.query(`
            SELECT b.*, u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.id = $1 OR b.booking_string_id = $1
        `, [bookingId]);
        return result.rows[0] || null;
    }

    async getAllBookings(filters = {}) {
        let query = `
            SELECT b.*, u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email
            FROM bookings b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            query += ` AND b.booking_status = $${paramCount}`;
            params.push(filters.status);
        }

        if (filters.eventId) {
            paramCount++;
            query += ` AND b.event_id = $${paramCount}`;
            params.push(filters.eventId);
        }

        if (filters.dateFrom) {
            paramCount++;
            query += ` AND b.created_at >= $${paramCount}`;
            params.push(filters.dateFrom);
        }

        if (filters.dateTo) {
            paramCount++;
            query += ` AND b.created_at <= $${paramCount}`;
            params.push(filters.dateTo);
        }

        query += ` ORDER BY b.created_at DESC`;

        if (filters.limit) {
            paramCount++;
            query += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await this.query(query, params);
        return result.rows;
    }

    // Payment operations
    async createPayment(paymentData) {
        return await this.query(`
            INSERT INTO payments (
                booking_id, user_id, transaction_id, amount, currency, status, 
                payment_method, provider, provider_transaction_id, raw_payload
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            paymentData.bookingId,
            paymentData.userId,
            paymentData.transactionId,
            paymentData.amount,
            paymentData.currency || 'KGS',
            paymentData.status,
            paymentData.paymentMethod,
            paymentData.provider,
            paymentData.providerTransactionId,
            paymentData.rawPayload ? JSON.stringify(paymentData.rawPayload) : null
        ]);
    }

    async updatePaymentStatus(paymentId, status, processedAt = null) {
        return await this.query(`
            UPDATE payments 
            SET status = $1, processed_at = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        `, [status, processedAt || new Date(), paymentId]);
    }

    // Ticket operations
    async createTicket(ticketData) {
        return await this.query(`
            INSERT INTO tickets (
                booking_id, ticket_id, file_path, file_name, file_size, mime_type
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            ticketData.bookingId,
            ticketData.ticketId,
            ticketData.filePath,
            ticketData.fileName,
            ticketData.fileSize,
            ticketData.mimeType
        ]);
    }

    async updateBookingTicketStatus(bookingId, ticketGenerated = true, ticketSent = false, ticketId = null, filePath = null) {
        return await this.query(`
            UPDATE bookings 
            SET ticket_generated = $1, ticket_sent = $2, ticket_id = $3, ticket_file_path = $4, updated_at = NOW()
            WHERE id = $5 OR booking_string_id = $5
            RETURNING *
        `, [ticketGenerated, ticketSent, ticketId, filePath, bookingId]);
    }

    // WhatsApp operations
    async createWhatsAppOptIn(optInData) {
        return await this.query(`
            INSERT INTO whatsapp_opt_ins (
                user_id, phone, phone_normalized, name, confirmation_code, 
                optin_source, ip_address, user_agent, consent_text, booking_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (phone) 
            DO UPDATE SET 
                confirmed = COALESCE(EXCLUDED.confirmed, whatsapp_opt_ins.confirmed),
                confirmation_code = COALESCE(EXCLUDED.confirmation_code, whatsapp_opt_ins.confirmation_code),
                updated_at = NOW()
            RETURNING *
        `, [
            optInData.userId,
            optInData.phone,
            optInData.phoneNormalized,
            optInData.name,
            optInData.confirmationCode,
            optInData.optinSource,
            optInData.ipAddress,
            optInData.userAgent,
            optInData.consentText,
            optInData.bookingId
        ]);
    }

    async confirmWhatsAppOptIn(phone, confirmationCode) {
        return await this.query(`
            UPDATE whatsapp_opt_ins 
            SET confirmed = true, confirmed_at = NOW(), updated_at = NOW()
            WHERE phone = $1 AND confirmation_code = $2
            RETURNING *
        `, [phone, confirmationCode]);
    }

    async logMessage(messageData) {
        return await this.query(`
            INSERT INTO messages_log (
                message_id, phone, direction, body, status, error_code, 
                provider, booking_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            messageData.messageId,
            messageData.phone,
            messageData.direction,
            messageData.body,
            messageData.status,
            messageData.errorCode,
            messageData.provider,
            messageData.bookingId
        ]);
    }

    // System logging
    async logSystemEvent(level, message, context = {}, userId = null, bookingId = null, ipAddress = null, userAgent = null) {
        return await this.query(`
            INSERT INTO system_logs (level, message, context, user_id, booking_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [level, message, JSON.stringify(context), userId, bookingId, ipAddress, userAgent]);
    }

    // Health check
    async healthCheck() {
        try {
            const result = await this.query('SELECT NOW() as current_time, version() as postgres_version');
            return {
                status: 'healthy',
                connected: this.isConnected,
                timestamp: result.rows[0].current_time,
                postgresVersion: result.rows[0].postgres_version
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message
            };
        }
    }

    // Close connection
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('✅ Database connection closed');
        }
    }
}

module.exports = DatabaseService;
