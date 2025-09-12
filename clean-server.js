const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const cors = require('cors');
const { Blob } = require('buffer');
const { FormData } = require('undici');
const config = require('./config');
const SecureTicketSystem = require('./secure-ticket-system');
const BookingService = require('./lib/booking-service');

const app = express();
const server = createServer(app);

// Configure Socket.IO with proper CORS for localhost testing
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for localhost testing
        methods: ["GET", "POST"],
        credentials: false
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || config.server.port || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('.'));

// Initialize Secure Ticket System
const secureTicketSystem = new SecureTicketSystem(
    config.tickets?.secretKey || 'default-secret-key-change-in-production',
    path.join(__dirname, 'secure-tickets-database.json')
);

// Initialize Booking Service
const bookingService = new BookingService();

// Function to emit seat updates to all connected clients
async function emitSeatUpdate() {
    try {
        // Get current seat statuses from booking service
        const seatStatuses = await bookingService.getSeatStatuses();
        
        // Count statuses for logging
        const statusCounts = Object.values(seatStatuses).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        console.log('📊 Emitting seat update:', {
            totalSeats: Object.keys(seatStatuses).length,
            statusCounts,
            timestamp: new Date().toISOString()
        });
        
        // Emit to all connected clients
        io.emit('seatUpdate', {
            seatStatuses,
            statusCounts,
            totalSeats: Object.keys(seatStatuses).length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error emitting seat update:', error);
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    // Send connection confirmation
    socket.emit('connected', {
        message: 'Connected to ticketing server',
        socketId: socket.id,
        timestamp: new Date().toISOString()
    });
    
    // Handle seat data requests
    socket.on('requestSeatData', async () => {
        console.log(`📡 Seat data requested by ${socket.id}`);
        await emitSeatUpdate();
    });
    
    // Handle ping/pong for connection health
    socket.on('ping', (data) => {
        socket.emit('pong', {
            ...data,
            serverTime: new Date().toISOString()
        });
    });
    
    // Handle test events
    socket.on('test', (data) => {
        console.log('🧪 Test event received:', data);
        socket.emit('test', {
            ...data,
            serverResponse: 'Test successful',
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle admin authentication
    socket.on('authenticate', (data) => {
        if (data.role === 'admin' && data.password === 'admin123') {
            socket.join('admins');
            socket.emit('authSuccess', {
                message: 'Admin authenticated successfully',
                room: 'admins',
                timestamp: new Date().toISOString()
            });
            console.log(`👨‍💼 Admin authenticated: ${socket.id}`);
        } else {
            socket.emit('authError', {
                message: 'Authentication failed',
                timestamp: new Date().toISOString()
            });
        }
    });
    
    // Handle identify events
    socket.on('identify', (data) => {
        if (data.role === 'admin') {
            socket.join('admins');
            console.log(`👨‍💼 Admin identified: ${socket.id}`);
        } else if (data.role === 'student') {
            socket.join('students');
            console.log(`🎓 Student identified: ${socket.id}`);
        }
    });
    
    socket.on('disconnect', (reason) => {
        console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
    });
});

// API Routes

// Health check endpoint
app.get('/api/test/socket-info', (req, res) => {
    const connectedClients = io.engine.clientsCount;
    res.json({
        success: true,
        message: 'Socket.IO server is running',
        connectedClients,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Test endpoint to emit seat update
app.post('/api/test/emit-seat-update', async (req, res) => {
    try {
        await emitSeatUpdate();
        res.json({
            success: true,
            message: 'Seat update emitted to all clients',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Centralized Booking API

// Create new booking
app.post('/api/book', async (req, res) => {
    try {
        const bookingData = req.body;
        
        // Validate required fields
        if (!bookingData.firstName || !bookingData.lastName || !bookingData.email || !bookingData.phone || !bookingData.seatId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: firstName, lastName, email, phone, seatId'
            });
        }
        
        // Parse seat ID
        const seatParts = bookingData.seatId.split('-');
        if (seatParts.length !== 2) {
            return res.status(400).json({
                success: false,
                error: 'Invalid seatId format. Expected format: table-seat (e.g., 1-1)'
            });
        }
        
        const table = parseInt(seatParts[0]);
        const seat = parseInt(seatParts[1]);
        
        if (isNaN(table) || isNaN(seat) || table < 1 || table > 36 || seat < 1 || seat > 14) {
            return res.status(400).json({
                success: false,
                error: 'Invalid seat coordinates. Table must be 1-36, seat must be 1-14'
            });
        }
        
        // Create booking using centralized service
        const booking = await bookingService.createBooking(bookingData);
        
        // Emit booking created event
        io.emit('booking:created', {
            booking: booking,
            type: 'created',
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            bookingId: booking.id,
            booking: booking
        });
        
    } catch (error) {
        console.error('Error creating booking:', error);
        
        if (error.message.includes('already booked') || error.message.includes('not available')) {
            res.status(409).json({
                success: false,
                error: 'Seat is already booked or not available',
                seatId: req.body.seatId
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
});

// Get all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const status = req.query.status;
        const bookings = await bookingService.getAllBookings(status);
        
        res.json({
            success: true,
            bookings: bookings,
            count: bookings.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting bookings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get single booking
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await bookingService.getBooking(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        
        res.json({
            success: true,
            booking: booking
        });
        
    } catch (error) {
        console.error('Error getting booking:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Confirm booking
app.post('/api/bookings/:id/confirm', async (req, res) => {
    try {
        const { confirmedBy } = req.body;
        const booking = await bookingService.confirmBooking(req.params.id, confirmedBy);
        
        // Emit booking updated event
        io.emit('booking:updated', {
            booking: booking,
            type: 'confirmed',
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Booking confirmed successfully',
            booking: booking
        });
        
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update booking
app.patch('/api/bookings/:id', async (req, res) => {
    try {
        const updates = req.body;
        const booking = await bookingService.updateBooking(req.params.id, updates);
        
        // Emit booking updated event
        io.emit('booking:updated', {
            booking: booking,
            type: 'updated',
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Booking updated successfully',
            booking: booking
        });
        
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete booking
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await bookingService.getBooking(req.params.id);
        await bookingService.deleteBooking(req.params.id);
        
        // Emit booking deleted event
        io.emit('booking:deleted', {
            booking: booking,
            type: 'deleted',
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Booking deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Sync local bookings
app.post('/api/sync-bookings', async (req, res) => {
    try {
        const { bookings } = req.body;
        const result = await bookingService.syncLocalBookings(bookings);
        
        res.json({
            success: true,
            message: 'Local bookings synced successfully',
            syncedCount: result.syncedCount,
            skippedCount: result.skippedCount
        });
        
    } catch (error) {
        console.error('Error syncing bookings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy API endpoints for backward compatibility

// Legacy create booking (redirects to new endpoint)
app.post('/api/create-booking', async (req, res) => {
    // Convert legacy format to new format
    const legacyData = req.body;
    const newData = {
        firstName: legacyData.fullName?.split(' ')[0] || legacyData.firstName,
        lastName: legacyData.fullName?.split(' ').slice(1).join(' ') || legacyData.lastName,
        email: legacyData.email,
        phone: legacyData.phone,
        seatId: legacyData.selectedSeats?.[0] || legacyData.seatId,
        table: legacyData.table,
        seat: legacyData.seat,
        price: legacyData.totalPrice || legacyData.price || 5900,
        status: 'pending',
        bookingDate: new Date().toISOString()
    };
    
    // Forward to new endpoint
    req.body = newData;
    return app._router.handle(req, res);
});

// Legacy get bookings (redirects to new endpoint)
app.get('/api/bookings-legacy', async (req, res) => {
    try {
        // Read from JSON file for legacy compatibility
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        res.json({
            success: true,
            bookings: bookings,
            count: Object.keys(bookings).length,
            source: 'legacy-json'
        });
        
    } catch (error) {
        console.error('Error getting legacy bookings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy delete booking (redirects to new endpoint)
app.delete('/api/delete-booking/:bookingId', async (req, res) => {
    // Forward to new endpoint
    req.url = `/api/bookings/${req.params.bookingId}`;
    return app._router.handle(req, res);
});

// Get seat statuses
app.get('/api/seat-statuses', async (req, res) => {
    try {
        const seatStatuses = await bookingService.getSeatStatuses();
        
        res.json({
            success: true,
            seatStatuses: seatStatuses,
            count: Object.keys(seatStatuses).length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting seat statuses:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Confirm payment (legacy endpoint)
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { bookingId, paymentMethod } = req.body;
        
        if (!bookingId) {
            return res.status(400).json({
                success: false,
                error: 'Booking ID is required'
            });
        }
        
        // Get booking from centralized service
        const booking = await bookingService.getBooking(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }
        
        // Update booking status to confirmed
        const updatedBooking = await bookingService.updateBooking(bookingId, {
            status: 'confirmed',
            metadata: {
                ...booking.metadata,
                paymentDate: new Date().toISOString(),
                paymentMethod: paymentMethod || 'unknown',
                paymentConfirmedBy: 'admin'
            }
        });
        
        // Generate ticket
        const ticketData = {
            bookingId: bookingId,
            firstName: booking.userInfo.firstName,
            lastName: booking.userInfo.lastName,
            email: booking.userInfo.email,
            phone: booking.userInfo.phone,
            seatId: booking.seatId,
            price: booking.metadata.price || 5900,
            paymentDate: new Date().toISOString()
        };
        
        const ticketResult = await secureTicketSystem.generateTicket(ticketData);
        
        // Emit booking updated event
        io.emit('booking:updated', {
            booking: updatedBooking,
            type: 'payment_confirmed',
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Payment confirmed and ticket generated',
            booking: updatedBooking,
            ticketId: ticketResult.ticketId,
            ticketPath: ticketResult.ticketPath
        });
        
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Admin functions
app.post('/api/admin/release-all-seats', async (req, res) => {
    try {
        const { adminPassword } = req.body;
        
        if (adminPassword !== 'admin123') {
            return res.status(401).json({
                success: false,
                error: 'Invalid admin password'
            });
        }
        
        // Get all bookings and delete them
        const bookings = await bookingService.getAllBookings();
        let deletedCount = 0;
        
        for (const booking of bookings) {
            await bookingService.deleteBooking(booking.id);
            deletedCount++;
        }
        
        // Emit bulk update
        io.emit('seatBulkUpdate', {
            type: 'release_all',
            message: `Released ${deletedCount} seats`,
            deletedCount: deletedCount,
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.json({
            success: true,
            message: `Released ${deletedCount} seats`,
            deletedCount: deletedCount
        });
        
    } catch (error) {
        console.error('Error releasing seats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/admin/prebook-seats', async (req, res) => {
    try {
        const { adminPassword, seatIds, count, prebookType } = req.body;
        
        if (adminPassword !== 'admin123') {
            return res.status(401).json({
                success: false,
                error: 'Invalid admin password'
            });
        }
        
        let seatsToPrebook = [];
        
        if (prebookType === 'manual' && seatIds) {
            seatsToPrebook = seatIds;
        } else if (prebookType === 'random' && count) {
            // Generate random seats
            const allSeats = [];
            for (let table = 1; table <= 36; table++) {
                for (let seat = 1; seat <= 14; seat++) {
                    allSeats.push(`${table}-${seat}`);
                }
            }
            
            // Shuffle and take random seats
            const shuffled = allSeats.sort(() => 0.5 - Math.random());
            seatsToPrebook = shuffled.slice(0, Math.min(count, allSeats.length));
        }
        
        let prebookedCount = 0;
        
        for (const seatId of seatsToPrebook) {
            try {
                const bookingData = {
                    firstName: 'Prebooked',
                    lastName: 'Seat',
                    email: 'prebook@system.local',
                    phone: '+0000000000',
                    seatId: seatId,
                    table: parseInt(seatId.split('-')[0]),
                    seat: parseInt(seatId.split('-')[1]),
                    price: 5900,
                    status: 'pending',
                    bookingDate: new Date().toISOString()
                };
                
                await bookingService.createBooking(bookingData);
                prebookedCount++;
                
            } catch (error) {
                console.log(`Failed to prebook seat ${seatId}:`, error.message);
            }
        }
        
        // Emit bulk update
        io.emit('seatBulkUpdate', {
            type: 'prebook',
            message: `Pre-booked ${prebookedCount} seats`,
            prebookedCount: prebookedCount,
            seats: seatsToPrebook,
            timestamp: new Date().toISOString()
        });
        
        // Emit seat update
        await emitSeatUpdate();
        
        res.json({
            success: true,
            message: `Pre-booked ${prebookedCount} seats`,
            prebookedCount: prebookedCount,
            seats: seatsToPrebook
        });
        
    } catch (error) {
        console.error('Error prebooking seats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
server.listen(PORT, () => {
    console.log('🔐 Secure Ticket System initialized');
    console.log('📁 Tickets database:', path.join(__dirname, 'secure-tickets-database.json'));
    console.log('🚀 Server started successfully!');
    console.log('🌐 HTTP Server: http://localhost:' + PORT);
    console.log('🔌 Socket.IO Server: ws://localhost:' + PORT + '/socket.io/');
    console.log('📱 Admin panel: http://localhost:' + PORT + '/admin.html');
    console.log('🎓 Student portal: http://localhost:' + PORT + '/index.html');
    console.log('🧪 Test page: http://localhost:' + PORT + '/socket-test.html');
    console.log('🔐 API Endpoints:');
    console.log('  POST /api/book - Create new booking (centralized)');
    console.log('  GET  /api/bookings - Get all bookings');
    console.log('  GET  /api/bookings/:id - Get single booking');
    console.log('  POST /api/bookings/:id/confirm - Confirm booking');
    console.log('  PATCH /api/bookings/:id - Update booking');
    console.log('  DELETE /api/bookings/:id - Delete booking');
    console.log('  POST /api/sync-bookings - Sync local bookings');
    console.log('  POST /api/create-booking - Create booking (legacy)');
    console.log('  POST /api/confirm-payment - Confirm payment');
    console.log('  DELETE /api/delete-booking/:id - Delete booking (legacy)');
    console.log('  GET  /api/seat-statuses - Get seat statuses');
    console.log('  POST /api/test/emit-seat-update - Test seat update');
    console.log('  GET  /api/test/socket-info - Socket.IO info');
    console.log('🔌 Socket.IO Events:');
    console.log('  seatUpdate - Real-time seat status updates');
    console.log('  booking:created - New booking created');
    console.log('  booking:updated - Booking updated');
    console.log('  booking:deleted - Booking deleted');
    console.log('  connected - Connection confirmation');
    console.log('  test - Test event');
    console.log('  requestSeatData - Request current seat data');
    console.log('  ping/pong - Connection health check');
    console.log('🎯 Ready for real-time seat booking!');
});
