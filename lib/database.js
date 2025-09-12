/**
 * Database abstraction layer for the ticketing system
 * Supports PostgreSQL (primary) and SQLite (fallback)
 */

const fs = require('fs-extra');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbType = null;
        this.isConnected = false;
        this.connectionString = process.env.DATABASE_URL;
        
        // Initialize database connection
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            if (this.connectionString) {
                // Use PostgreSQL if DATABASE_URL is provided
                await this.initializePostgreSQL();
            } else {
                // Fallback to SQLite
                await this.initializeSQLite();
            }
            
            console.log(`✅ Database initialized: ${this.dbType}`);
            this.isConnected = true;
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            console.log('🔄 Falling back to JSON file storage...');
            await this.initializeJSONFallback();
        }
    }

    async initializePostgreSQL() {
        try {
            const { Pool } = require('pg');
            
            this.db = new Pool({
                connectionString: this.connectionString,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            // Test connection
            const client = await this.db.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.dbType = 'postgresql';
            console.log('🐘 PostgreSQL connected successfully');
        } catch (error) {
            console.error('❌ PostgreSQL connection failed:', error);
            throw error;
        }
    }

    async initializeSQLite() {
        try {
            const sqlite3 = require('sqlite3').verbose();
            const dbPath = path.join(__dirname, '..', 'data', 'bookings.db');
            
            // Ensure data directory exists
            await fs.ensureDir(path.dirname(dbPath));
            
            this.db = new sqlite3.Database(dbPath);
            this.dbType = 'sqlite';
            
            // Run SQLite schema migration
            await this.runSQLiteMigration();
            
            console.log('🗃️ SQLite connected successfully');
        } catch (error) {
            console.error('❌ SQLite connection failed:', error);
            throw error;
        }
    }

    async initializeJSONFallback() {
        this.dbType = 'json';
        this.isConnected = true;
        console.log('📄 Using JSON file fallback storage');
    }

    async runSQLiteMigration() {
        const migrationPath = path.join(__dirname, '..', 'migrations', '002_create_sqlite_schema.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            this.db.exec(migrationSQL, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async runPostgreSQLMigration() {
        const migrationPath = path.join(__dirname, '..', 'migrations', '001_create_bookings_table.sql');
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');
        
        const client = await this.db.connect();
        try {
            await client.query(migrationSQL);
        } finally {
            client.release();
        }
    }

    // Generic booking operations
    async createBooking(bookingData) {
        if (this.dbType === 'postgresql') {
            return this.createBookingPostgreSQL(bookingData);
        } else if (this.dbType === 'sqlite') {
            return this.createBookingSQLite(bookingData);
        } else {
            return this.createBookingJSON(bookingData);
        }
    }

    async getBooking(id) {
        if (this.dbType === 'postgresql') {
            return this.getBookingPostgreSQL(id);
        } else if (this.dbType === 'sqlite') {
            return this.getBookingSQLite(id);
        } else {
            return this.getBookingJSON(id);
        }
    }

    async getAllBookings(status = null) {
        if (this.dbType === 'postgresql') {
            return this.getAllBookingsPostgreSQL(status);
        } else if (this.dbType === 'sqlite') {
            return this.getAllBookingsSQLite(status);
        } else {
            return this.getAllBookingsJSON(status);
        }
    }

    async updateBooking(id, updates) {
        if (this.dbType === 'postgresql') {
            return this.updateBookingPostgreSQL(id, updates);
        } else if (this.dbType === 'sqlite') {
            return this.updateBookingSQLite(id, updates);
        } else {
            return this.updateBookingJSON(id, updates);
        }
    }

    async deleteBooking(id) {
        if (this.dbType === 'postgresql') {
            return this.deleteBookingPostgreSQL(id);
        } else if (this.dbType === 'sqlite') {
            return this.deleteBookingSQLite(id);
        } else {
            return this.deleteBookingJSON(id);
        }
    }

    async checkSeatAvailability(seatId) {
        if (this.dbType === 'postgresql') {
            return this.checkSeatAvailabilityPostgreSQL(seatId);
        } else if (this.dbType === 'sqlite') {
            return this.checkSeatAvailabilitySQLite(seatId);
        } else {
            return this.checkSeatAvailabilityJSON(seatId);
        }
    }

    // PostgreSQL implementations
    async createBookingPostgreSQL(bookingData) {
        const client = await this.db.connect();
        try {
            const query = `
                INSERT INTO bookings (id, seat_id, user_info, status, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            
            const values = [
                bookingData.id,
                bookingData.seatId,
                JSON.stringify(bookingData.userInfo),
                bookingData.status,
                JSON.stringify(bookingData.metadata || {})
            ];

            const result = await client.query(query, values);
            return this.formatBookingPostgreSQL(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async getBookingPostgreSQL(id) {
        const client = await this.db.connect();
        try {
            const query = 'SELECT * FROM bookings WHERE id = $1';
            const result = await client.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return this.formatBookingPostgreSQL(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async getAllBookingsPostgreSQL(status = null) {
        const client = await this.db.connect();
        try {
            let query = 'SELECT * FROM bookings';
            let values = [];
            
            if (status) {
                query += ' WHERE status = $1';
                values = [status];
            }
            
            query += ' ORDER BY created_at DESC';
            
            const result = await client.query(query, values);
            return result.rows.map(row => this.formatBookingPostgreSQL(row));
        } finally {
            client.release();
        }
    }

    async updateBookingPostgreSQL(id, updates) {
        const client = await this.db.connect();
        try {
            const setClause = [];
            const values = [];
            let paramCount = 1;

            if (updates.userInfo) {
                setClause.push(`user_info = $${paramCount++}`);
                values.push(JSON.stringify(updates.userInfo));
            }
            
            if (updates.status) {
                setClause.push(`status = $${paramCount++}`);
                values.push(updates.status);
            }
            
            if (updates.metadata) {
                setClause.push(`metadata = $${paramCount++}`);
                values.push(JSON.stringify(updates.metadata));
            }

            if (setClause.length === 0) {
                throw new Error('No updates provided');
            }

            values.push(id);
            const query = `
                UPDATE bookings 
                SET ${setClause.join(', ')}
                WHERE id = $${paramCount}
                RETURNING *
            `;

            const result = await client.query(query, values);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return this.formatBookingPostgreSQL(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async deleteBookingPostgreSQL(id) {
        const client = await this.db.connect();
        try {
            const query = 'DELETE FROM bookings WHERE id = $1 RETURNING *';
            const result = await client.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            return this.formatBookingPostgreSQL(result.rows[0]);
        } finally {
            client.release();
        }
    }

    async checkSeatAvailabilityPostgreSQL(seatId) {
        const client = await this.db.connect();
        try {
            const query = `
                SELECT COUNT(*) as count 
                FROM bookings 
                WHERE seat_id = $1 AND status IN ('confirmed', 'pending')
            `;
            
            const result = await client.query(query, [seatId]);
            return parseInt(result.rows[0].count) === 0;
        } finally {
            client.release();
        }
    }

    // SQLite implementations
    async createBookingSQLite(bookingData) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO bookings (id, seat_id, user_info, status, metadata)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const values = [
                bookingData.id,
                bookingData.seatId,
                JSON.stringify(bookingData.userInfo),
                bookingData.status,
                JSON.stringify(bookingData.metadata || {})
            ];

            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Get the created booking
                    this.getBookingSQLite(bookingData.id)
                        .then(resolve)
                        .catch(reject);
                }
            }.bind(this));
        });
    }

    async getBookingSQLite(id) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM bookings WHERE id = ?';
            
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve(null);
                } else {
                    resolve(this.formatBookingSQLite(row));
                }
            });
        });
    }

    async getAllBookingsSQLite(status = null) {
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM bookings';
            let params = [];
            
            if (status) {
                query += ' WHERE status = ?';
                params = [status];
            }
            
            query += ' ORDER BY created_at DESC';
            
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => this.formatBookingSQLite(row)));
                }
            });
        });
    }

    async updateBookingSQLite(id, updates) {
        return new Promise((resolve, reject) => {
            const setClause = [];
            const values = [];

            if (updates.userInfo) {
                setClause.push('user_info = ?');
                values.push(JSON.stringify(updates.userInfo));
            }
            
            if (updates.status) {
                setClause.push('status = ?');
                values.push(updates.status);
            }
            
            if (updates.metadata) {
                setClause.push('metadata = ?');
                values.push(JSON.stringify(updates.metadata));
            }

            if (setClause.length === 0) {
                reject(new Error('No updates provided'));
                return;
            }

            values.push(id);
            const query = `
                UPDATE bookings 
                SET ${setClause.join(', ')}
                WHERE id = ?
            `;

            this.db.run(query, values, function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    resolve(null);
                } else {
                    // Get the updated booking
                    this.getBookingSQLite(id)
                        .then(resolve)
                        .catch(reject);
                }
            }.bind(this));
        });
    }

    async deleteBookingSQLite(id) {
        return new Promise((resolve, reject) => {
            const query = 'DELETE FROM bookings WHERE id = ?';
            
            this.db.run(query, [id], function(err) {
                if (err) {
                    reject(err);
                } else if (this.changes === 0) {
                    resolve(null);
                } else {
                    resolve({ id, deleted: true });
                }
            });
        });
    }

    async checkSeatAvailabilitySQLite(seatId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT COUNT(*) as count 
                FROM bookings 
                WHERE seat_id = ? AND status IN ('confirmed', 'pending')
            `;
            
            this.db.get(query, [seatId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(parseInt(row.count) === 0);
                }
            });
        });
    }

    // JSON fallback implementations
    async createBookingJSON(bookingData) {
        const bookingsPath = path.join(__dirname, '..', 'data', 'bookings.json');
        await fs.ensureDir(path.dirname(bookingsPath));
        
        let bookings = {};
        if (await fs.pathExists(bookingsPath)) {
            const data = await fs.readFile(bookingsPath, 'utf8');
            bookings = JSON.parse(data);
        }
        
        bookings[bookingData.id] = {
            ...bookingData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(bookingsPath, JSON.stringify(bookings, null, 2));
        return bookings[bookingData.id];
    }

    async getBookingJSON(id) {
        const bookingsPath = path.join(__dirname, '..', 'data', 'bookings.json');
        
        if (!await fs.pathExists(bookingsPath)) {
            return null;
        }
        
        const data = await fs.readFile(bookingsPath, 'utf8');
        const bookings = JSON.parse(data);
        return bookings[id] || null;
    }

    async getAllBookingsJSON(status = null) {
        const bookingsPath = path.join(__dirname, '..', 'data', 'bookings.json');
        
        if (!await fs.pathExists(bookingsPath)) {
            return [];
        }
        
        const data = await fs.readFile(bookingsPath, 'utf8');
        const bookings = JSON.parse(data);
        
        let allBookings = Object.values(bookings);
        
        if (status) {
            allBookings = allBookings.filter(booking => booking.status === status);
        }
        
        return allBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async updateBookingJSON(id, updates) {
        const bookingsPath = path.join(__dirname, '..', 'data', 'bookings.json');
        
        if (!await fs.pathExists(bookingsPath)) {
            return null;
        }
        
        const data = await fs.readFile(bookingsPath, 'utf8');
        const bookings = JSON.parse(data);
        
        if (!bookings[id]) {
            return null;
        }
        
        bookings[id] = {
            ...bookings[id],
            ...updates,
            updated_at: new Date().toISOString()
        };
        
        await fs.writeFile(bookingsPath, JSON.stringify(bookings, null, 2));
        return bookings[id];
    }

    async deleteBookingJSON(id) {
        const bookingsPath = path.join(__dirname, '..', 'data', 'bookings.json');
        
        if (!await fs.pathExists(bookingsPath)) {
            return null;
        }
        
        const data = await fs.readFile(bookingsPath, 'utf8');
        const bookings = JSON.parse(data);
        
        if (!bookings[id]) {
            return null;
        }
        
        const deletedBooking = bookings[id];
        delete bookings[id];
        
        await fs.writeFile(bookingsPath, JSON.stringify(bookings, null, 2));
        return deletedBooking;
    }

    async checkSeatAvailabilityJSON(seatId) {
        const bookings = await this.getAllBookingsJSON();
        return !bookings.some(booking => 
            booking.seatId === seatId && 
            ['confirmed', 'pending'].includes(booking.status)
        );
    }

    // Helper methods
    formatBookingPostgreSQL(row) {
        return {
            id: row.id,
            seatId: row.seat_id,
            userInfo: typeof row.user_info === 'string' ? JSON.parse(row.user_info) : row.user_info,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
        };
    }

    formatBookingSQLite(row) {
        return {
            id: row.id,
            seatId: row.seat_id,
            userInfo: typeof row.user_info === 'string' ? JSON.parse(row.user_info) : row.user_info,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
        };
    }

    async close() {
        if (this.db && this.dbType === 'postgresql') {
            await this.db.end();
        } else if (this.db && this.dbType === 'sqlite') {
            this.db.close();
        }
        this.isConnected = false;
    }
}

module.exports = DatabaseManager;
