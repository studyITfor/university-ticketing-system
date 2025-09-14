const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/golden_middle',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.on('connect', () => {
    console.log('🗄️ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ Database connection error:', err);
});

// Database initialization
async function initializeDatabase() {
    try {
        // Create tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                booking_id VARCHAR(50) UNIQUE NOT NULL,
                user_phone VARCHAR(20) NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                table_number INTEGER NOT NULL,
                seat_number INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payment_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone_number)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(100) UNIQUE NOT NULL,
                booking_id VARCHAR(50) NOT NULL,
                user_phone VARCHAR(20) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'KGS',
                status VARCHAR(20) DEFAULT 'pending',
                provider VARCHAR(50),
                raw_payload JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
                FOREIGN KEY (user_phone) REFERENCES users(phone_number)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                ticket_id VARCHAR(50) UNIQUE NOT NULL,
                booking_id VARCHAR(50) NOT NULL,
                user_phone VARCHAR(20) NOT NULL,
                ticket_data JSONB,
                status VARCHAR(20) DEFAULT 'generated',
                file_path VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
                FOREIGN KEY (user_phone) REFERENCES users(phone_number)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_actions (
                id SERIAL PRIMARY KEY,
                admin_id VARCHAR(50),
                action VARCHAR(100) NOT NULL,
                target_type VARCHAR(50),
                target_id VARCHAR(50),
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(user_phone);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_bookings_table_seat ON bookings(table_number, seat_number);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);
        `);

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

// User operations
async function createOrUpdateUser(phoneNumber, firstName, lastName, email = null) {
    const query = `
        INSERT INTO users (phone_number, first_name, last_name, email)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (phone_number)
        DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            email = EXCLUDED.email,
            updated_at = CURRENT_TIMESTAMP
        RETURNING *
    `;
    
    const result = await pool.query(query, [phoneNumber, firstName, lastName, email]);
    return result.rows[0];
}

// Booking operations
async function createBooking(bookingData) {
    const {
        bookingId,
        userPhone,
        firstName,
        lastName,
        tableNumber,
        seatNumber,
        status = 'pending'
    } = bookingData;

    const query = `
        INSERT INTO bookings (booking_id, user_phone, first_name, last_name, table_number, seat_number, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `;
    
    const result = await pool.query(query, [
        bookingId, userPhone, firstName, lastName, tableNumber, seatNumber, status
    ]);
    return result.rows[0];
}

async function getBookingById(bookingId) {
    const query = `
        SELECT b.*, u.email
        FROM bookings b
        LEFT JOIN users u ON b.user_phone = u.phone_number
        WHERE b.booking_id = $1
    `;
    
    const result = await pool.query(query, [bookingId]);
    return result.rows[0];
}

async function getAllBookings() {
    const query = `
        SELECT b.*, u.email
        FROM bookings b
        LEFT JOIN users u ON b.user_phone = u.phone_number
        ORDER BY b.created_at DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
}

async function updateBookingStatus(bookingId, status) {
    const query = `
        UPDATE bookings 
        SET status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE booking_id = $1
        RETURNING *
    `;
    
    const result = await pool.query(query, [bookingId, status]);
    return result.rows[0];
}

async function deleteBooking(bookingId) {
    const query = `
        DELETE FROM bookings 
        WHERE booking_id = $1
        RETURNING *
    `;
    
    const result = await pool.query(query, [bookingId]);
    return result.rows[0];
}

async function getSeatStatuses() {
    const query = `
        SELECT table_number, seat_number, status, booking_id
        FROM bookings
        WHERE status IN ('pending', 'paid', 'confirmed')
    `;
    
    const result = await pool.query(query);
    return result.rows;
}

// Payment operations
async function createPayment(paymentData) {
    const {
        transactionId,
        bookingId,
        userPhone,
        amount,
        currency = 'KGS',
        status = 'pending',
        provider,
        rawPayload
    } = paymentData;

    const query = `
        INSERT INTO payments (transaction_id, booking_id, user_phone, amount, currency, status, provider, raw_payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `;
    
    const result = await pool.query(query, [
        transactionId, bookingId, userPhone, amount, currency, status, provider, rawPayload
    ]);
    return result.rows[0];
}

async function updatePaymentStatus(transactionId, status) {
    const query = `
        UPDATE payments 
        SET status = $2, updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $1
        RETURNING *
    `;
    
    const result = await pool.query(query, [transactionId, status]);
    return result.rows[0];
}

// Admin actions
async function logAdminAction(adminId, action, targetType, targetId, details = null) {
    const query = `
        INSERT INTO admin_actions (admin_id, action, target_type, target_id, details)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const result = await pool.query(query, [adminId, action, targetType, targetId, details]);
    return result.rows[0];
}

async function getAdminActions() {
    const query = `
        SELECT * FROM admin_actions
        ORDER BY created_at DESC
        LIMIT 100
    `;
    
    const result = await pool.query(query);
    return result.rows;
}

// Health check
async function checkDatabaseHealth() {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('Database health check failed:', error);
        return false;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    createOrUpdateUser,
    createBooking,
    getBookingById,
    getAllBookings,
    updateBookingStatus,
    deleteBooking,
    getSeatStatuses,
    createPayment,
    updatePaymentStatus,
    logAdminAction,
    getAdminActions,
    checkDatabaseHealth
};
