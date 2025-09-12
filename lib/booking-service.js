/**
 * Booking Service - Centralized booking management
 * Handles all booking operations with proper validation and error handling
 */

const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./database');

class BookingService {
    constructor() {
        this.db = new DatabaseManager();
        this.logger = console; // Can be replaced with proper logging service
    }

    /**
     * Create a new booking
     * @param {Object} bookingData - Booking data
     * @returns {Promise<Object>} Created booking
     */
    async createBooking(bookingData) {
        try {
            // Validate input
            this.validateBookingData(bookingData);
            
            // Generate UUID if not provided
            const id = bookingData.id || uuidv4();
            
            // Check seat availability
            const isAvailable = await this.db.checkSeatAvailability(bookingData.seatId);
            if (!isAvailable) {
                throw new Error('Seat is already booked');
            }
            
            // Prepare booking data
            const booking = {
                id,
                seatId: bookingData.seatId,
                userInfo: {
                    firstName: bookingData.firstName,
                    lastName: bookingData.lastName,
                    email: bookingData.email,
                    phone: bookingData.phone
                },
                status: 'pending',
                metadata: {
                    price: bookingData.price || 5900,
                    bookingDate: new Date().toISOString(),
                    source: bookingData.source || 'web',
                    ...bookingData.metadata
                }
            };
            
            // Create booking in database
            const createdBooking = await this.db.createBooking(booking);
            
            this.logger.log(`✅ Booking created: ${id} for seat ${bookingData.seatId}`);
            
            return {
                success: true,
                booking: createdBooking,
                message: 'Booking created successfully'
            };
            
        } catch (error) {
            this.logger.error('❌ Error creating booking:', error);
            throw error;
        }
    }

    /**
     * Get a booking by ID
     * @param {string} id - Booking ID
     * @returns {Promise<Object|null>} Booking data or null
     */
    async getBooking(id) {
        try {
            if (!id) {
                throw new Error('Booking ID is required');
            }
            
            const booking = await this.db.getBooking(id);
            return booking;
            
        } catch (error) {
            this.logger.error('❌ Error getting booking:', error);
            throw error;
        }
    }

    /**
     * Get all bookings with optional status filter
     * @param {string} status - Optional status filter
     * @returns {Promise<Array>} Array of bookings
     */
    async getAllBookings(status = null) {
        try {
            const bookings = await this.db.getAllBookings(status);
            return bookings;
            
        } catch (error) {
            this.logger.error('❌ Error getting all bookings:', error);
            throw error;
        }
    }

    /**
     * Update a booking
     * @param {string} id - Booking ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object|null>} Updated booking or null
     */
    async updateBooking(id, updates) {
        try {
            if (!id) {
                throw new Error('Booking ID is required');
            }
            
            // Validate updates
            this.validateBookingUpdates(updates);
            
            const updatedBooking = await this.db.updateBooking(id, updates);
            
            if (updatedBooking) {
                this.logger.log(`✅ Booking updated: ${id}`);
            }
            
            return updatedBooking;
            
        } catch (error) {
            this.logger.error('❌ Error updating booking:', error);
            throw error;
        }
    }

    /**
     * Confirm a booking (change status to confirmed)
     * @param {string} id - Booking ID
     * @param {Object} confirmationData - Confirmation data
     * @returns {Promise<Object>} Confirmed booking
     */
    async confirmBooking(id, confirmationData = {}) {
        try {
            const updates = {
                status: 'confirmed',
                metadata: {
                    ...confirmationData,
                    confirmedAt: new Date().toISOString(),
                    confirmedBy: confirmationData.confirmedBy || 'admin'
                }
            };
            
            const confirmedBooking = await this.updateBooking(id, updates);
            
            if (!confirmedBooking) {
                throw new Error('Booking not found');
            }
            
            this.logger.log(`✅ Booking confirmed: ${id}`);
            
            return {
                success: true,
                booking: confirmedBooking,
                message: 'Booking confirmed successfully'
            };
            
        } catch (error) {
            this.logger.error('❌ Error confirming booking:', error);
            throw error;
        }
    }

    /**
     * Cancel a booking
     * @param {string} id - Booking ID
     * @param {Object} cancellationData - Cancellation data
     * @returns {Promise<Object>} Cancelled booking
     */
    async cancelBooking(id, cancellationData = {}) {
        try {
            const updates = {
                status: 'cancelled',
                metadata: {
                    ...cancellationData,
                    cancelledAt: new Date().toISOString(),
                    cancelledBy: cancellationData.cancelledBy || 'admin'
                }
            };
            
            const cancelledBooking = await this.updateBooking(id, updates);
            
            if (!cancelledBooking) {
                throw new Error('Booking not found');
            }
            
            this.logger.log(`✅ Booking cancelled: ${id}`);
            
            return {
                success: true,
                booking: cancelledBooking,
                message: 'Booking cancelled successfully'
            };
            
        } catch (error) {
            this.logger.error('❌ Error cancelling booking:', error);
            throw error;
        }
    }

    /**
     * Delete a booking permanently
     * @param {string} id - Booking ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteBooking(id) {
        try {
            if (!id) {
                throw new Error('Booking ID is required');
            }
            
            const deletedBooking = await this.db.deleteBooking(id);
            
            if (!deletedBooking) {
                throw new Error('Booking not found');
            }
            
            this.logger.log(`✅ Booking deleted: ${id}`);
            
            return {
                success: true,
                booking: deletedBooking,
                message: 'Booking deleted successfully'
            };
            
        } catch (error) {
            this.logger.error('❌ Error deleting booking:', error);
            throw error;
        }
    }

    /**
     * Check if a seat is available
     * @param {string} seatId - Seat ID
     * @returns {Promise<boolean>} True if available
     */
    async isSeatAvailable(seatId) {
        try {
            if (!seatId) {
                throw new Error('Seat ID is required');
            }
            
            return await this.db.checkSeatAvailability(seatId);
            
        } catch (error) {
            this.logger.error('❌ Error checking seat availability:', error);
            throw error;
        }
    }

    /**
     * Get seat statuses for all seats
     * @returns {Promise<Object>} Seat statuses object
     */
    async getSeatStatuses() {
        try {
            const bookings = await this.getAllBookings();
            const seatStatuses = {};
            
            // Initialize all seats as available
            for (let table = 1; table <= 36; table++) {
                for (let seat = 1; seat <= 14; seat++) {
                    const seatId = `${table}-${seat}`;
                    seatStatuses[seatId] = 'active';
                }
            }
            
            // Update seat statuses based on bookings
            bookings.forEach(booking => {
                if (booking.status === 'confirmed' || booking.status === 'paid' || booking.status === 'Оплачен') {
                    seatStatuses[booking.seatId] = 'reserved';
                } else if (booking.status === 'pending') {
                    seatStatuses[booking.seatId] = 'pending';
                } else if (booking.status === 'prebooked') {
                    seatStatuses[booking.seatId] = 'paid'; // Pre-booked seats appear as "Booked (Paid)" for students
                }
            });
            
            return seatStatuses;
            
        } catch (error) {
            this.logger.error('❌ Error getting seat statuses:', error);
            throw error;
        }
    }

    /**
     * Sync bookings from localStorage (for migration)
     * @param {Object} localBookings - Bookings from localStorage
     * @returns {Promise<Object>} Sync result
     */
    async syncLocalBookings(localBookings) {
        try {
            let syncedCount = 0;
            const errors = [];
            
            for (const [bookingId, booking] of Object.entries(localBookings)) {
                try {
                    // Check if booking already exists
                    const existingBooking = await this.getBooking(bookingId);
                    
                    if (!existingBooking) {
                        // Convert localStorage booking format to new format
                        const newBooking = {
                            id: bookingId,
                            seatId: booking.seatId || `${booking.table}-${booking.seat}`,
                            userInfo: {
                                firstName: booking.firstName,
                                lastName: booking.lastName,
                                email: booking.email,
                                phone: booking.phone
                            },
                            status: booking.status || 'pending',
                            metadata: {
                                price: booking.price || 5900,
                                bookingDate: booking.bookingDate || new Date().toISOString(),
                                source: 'localStorage-sync',
                                originalData: booking
                            }
                        };
                        
                        await this.db.createBooking(newBooking);
                        syncedCount++;
                    }
                } catch (error) {
                    errors.push({ bookingId, error: error.message });
                }
            }
            
            this.logger.log(`✅ Synced ${syncedCount} bookings from localStorage`);
            
            return {
                success: true,
                syncedCount,
                errors,
                message: `Synced ${syncedCount} bookings from localStorage`
            };
            
        } catch (error) {
            this.logger.error('❌ Error syncing local bookings:', error);
            throw error;
        }
    }

    /**
     * Validate booking data
     * @param {Object} bookingData - Booking data to validate
     */
    validateBookingData(bookingData) {
        const errors = [];
        
        if (!bookingData.firstName || !bookingData.firstName.trim()) {
            errors.push('First name is required');
        }
        
        if (!bookingData.lastName || !bookingData.lastName.trim()) {
            errors.push('Last name is required');
        }
        
        if (!bookingData.email || !bookingData.email.trim()) {
            errors.push('Email is required');
        } else if (!this.isValidEmail(bookingData.email)) {
            errors.push('Invalid email format');
        }
        
        if (!bookingData.phone || !bookingData.phone.trim()) {
            errors.push('Phone is required');
        } else if (!this.isValidPhone(bookingData.phone)) {
            errors.push('Invalid phone format');
        }
        
        if (!bookingData.seatId || !bookingData.seatId.trim()) {
            errors.push('Seat ID is required');
        } else if (!this.isValidSeatId(bookingData.seatId)) {
            errors.push('Invalid seat ID format (expected: table-seat, e.g., 1-5)');
        }
        
        if (errors.length > 0) {
            throw new Error(`Validation failed: ${errors.join(', ')}`);
        }
    }

    /**
     * Validate booking updates
     * @param {Object} updates - Updates to validate
     */
    validateBookingUpdates(updates) {
        if (updates.userInfo) {
            if (updates.userInfo.email && !this.isValidEmail(updates.userInfo.email)) {
                throw new Error('Invalid email format');
            }
            
            if (updates.userInfo.phone && !this.isValidPhone(updates.userInfo.phone)) {
                throw new Error('Invalid phone format');
            }
        }
        
        if (updates.status && !['pending', 'confirmed', 'cancelled'].includes(updates.status)) {
            throw new Error('Invalid status. Must be pending, confirmed, or cancelled');
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone format
     * @param {string} phone - Phone to validate
     * @returns {boolean} True if valid
     */
    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    /**
     * Validate seat ID format
     * @param {string} seatId - Seat ID to validate
     * @returns {boolean} True if valid
     */
    isValidSeatId(seatId) {
        const parts = seatId.split('-');
        if (parts.length !== 2) return false;
        
        const table = parseInt(parts[0]);
        const seat = parseInt(parts[1]);
        
        return !isNaN(table) && !isNaN(seat) && 
               table >= 1 && table <= 36 && 
               seat >= 1 && seat <= 14;
    }

    /**
     * Close database connection
     */
    async close() {
        await this.db.close();
    }
}

module.exports = BookingService;
