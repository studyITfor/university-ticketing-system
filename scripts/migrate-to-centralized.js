#!/usr/bin/env node

/**
 * Migration script to move from localStorage/JSON to centralized database storage
 * This script helps migrate existing bookings to the new centralized system
 */

const fs = require('fs-extra');
const path = require('path');
const BookingService = require('../lib/booking-service');

class BookingMigration {
    constructor() {
        this.bookingService = new BookingService();
        this.backupDir = path.join(__dirname, '..', 'data', 'backups');
    }

    async run() {
        console.log('🚀 Starting booking migration to centralized storage...');
        
        try {
            // Create backup directory
            await fs.ensureDir(this.backupDir);
            
            // Step 1: Backup existing data
            await this.backupExistingData();
            
            // Step 2: Migrate bookings from JSON file
            await this.migrateFromJSON();
            
            // Step 3: Verify migration
            await this.verifyMigration();
            
            console.log('✅ Migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }
    }

    async backupExistingData() {
        console.log('📦 Creating backup of existing data...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.backupDir, `bookings-backup-${timestamp}.json`);
        
        // Backup existing bookings.json
        const bookingsPath = path.join(__dirname, '..', 'bookings.json');
        if (await fs.pathExists(bookingsPath)) {
            const bookings = await fs.readFile(bookingsPath, 'utf8');
            await fs.writeFile(backupFile, bookings);
            console.log(`✅ Backed up existing bookings to: ${backupFile}`);
        } else {
            console.log('ℹ️ No existing bookings.json found, skipping backup');
        }
    }

    async migrateFromJSON() {
        console.log('🔄 Migrating bookings from JSON file...');
        
        const bookingsPath = path.join(__dirname, '..', 'bookings.json');
        
        if (!await fs.pathExists(bookingsPath)) {
            console.log('ℹ️ No bookings.json found, nothing to migrate');
            return;
        }
        
        const bookingsData = await fs.readFile(bookingsPath, 'utf8');
        const bookings = JSON.parse(bookingsData);
        
        let migratedCount = 0;
        let errorCount = 0;
        
        for (const [bookingId, booking] of Object.entries(bookings)) {
            try {
                // Convert old format to new format
                const newBooking = {
                    id: bookingId,
                    seatId: booking.seatId || `${booking.table}-${booking.seat}`,
                    userInfo: {
                        firstName: booking.firstName,
                        lastName: booking.lastName,
                        email: booking.email,
                        phone: booking.phone
                    },
                    status: this.mapStatus(booking.status),
                    metadata: {
                        price: booking.price || 5900,
                        bookingDate: booking.bookingDate || new Date().toISOString(),
                        source: 'migration',
                        originalData: booking
                    }
                };
                
                // Check if booking already exists
                const existingBooking = await this.bookingService.getBooking(bookingId);
                if (!existingBooking) {
                    await this.bookingService.createBooking(newBooking);
                    migratedCount++;
                    console.log(`✅ Migrated booking: ${bookingId}`);
                } else {
                    console.log(`ℹ️ Booking ${bookingId} already exists, skipping`);
                }
                
            } catch (error) {
                console.error(`❌ Error migrating booking ${bookingId}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`📊 Migration summary: ${migratedCount} migrated, ${errorCount} errors`);
    }

    mapStatus(oldStatus) {
        const statusMap = {
            'pending': 'pending',
            'paid': 'confirmed',
            'confirmed': 'confirmed',
            'Оплачен': 'confirmed',
            'cancelled': 'cancelled',
            'prebooked': 'pending' // Pre-booked becomes pending in new system
        };
        
        return statusMap[oldStatus] || 'pending';
    }

    async verifyMigration() {
        console.log('🔍 Verifying migration...');
        
        const allBookings = await this.bookingService.getAllBookings();
        console.log(`📊 Total bookings in new system: ${allBookings.length}`);
        
        // Check seat statuses
        const seatStatuses = await this.bookingService.getSeatStatuses();
        const statusCounts = Object.values(seatStatuses).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Seat status distribution:', statusCounts);
        
        // Test a few operations
        try {
            const testBooking = await this.bookingService.getBooking(allBookings[0]?.id);
            if (testBooking) {
                console.log('✅ Database operations working correctly');
            }
        } catch (error) {
            console.error('❌ Database verification failed:', error);
        }
    }

    async rollback() {
        console.log('🔄 Rolling back migration...');
        
        // Find the most recent backup
        const backupFiles = await fs.readdir(this.backupDir);
        const latestBackup = backupFiles
            .filter(file => file.startsWith('bookings-backup-') && file.endsWith('.json'))
            .sort()
            .pop();
        
        if (!latestBackup) {
            console.log('❌ No backup files found for rollback');
            return;
        }
        
        const backupPath = path.join(this.backupDir, latestBackup);
        const backupData = await fs.readFile(backupPath, 'utf8');
        
        // Restore original bookings.json
        const bookingsPath = path.join(__dirname, '..', 'bookings.json');
        await fs.writeFile(bookingsPath, backupData);
        
        console.log(`✅ Rolled back to backup: ${latestBackup}`);
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];
    const migration = new BookingMigration();
    
    switch (command) {
        case 'migrate':
            await migration.run();
            break;
        case 'rollback':
            await migration.rollback();
            break;
        default:
            console.log('Usage: node migrate-to-centralized.js [migrate|rollback]');
            console.log('  migrate  - Migrate existing bookings to centralized storage');
            console.log('  rollback - Rollback to previous state using backup');
            process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = BookingMigration;
