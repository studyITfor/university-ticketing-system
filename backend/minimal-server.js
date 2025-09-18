const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

console.log('🚀 Starting minimal server...');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files
const FRONTEND_PATH = path.resolve(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_PATH));
app.use('/tickets', express.static(path.join(__dirname, '..', 'tickets')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'admin.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock database
const mockBookings = new Map();
let nextBookingId = 1;

// User payment confirmation endpoint
app.post('/api/user-payment-confirm', async (req, res) => {
    const { seatId, studentName, phone } = req.body;
    console.log('💳 User payment confirmation request:', { seatId, studentName, phone });

    if (!seatId || !studentName || !phone) {
        return res.status(400).json({ error: 'seatId, studentName, and phone are required' });
    }

    try {
        const bookingId = 'BKM' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const booking = {
            id: nextBookingId++,
            bookingId,
            seatId,
            studentName,
            phone,
            status: 'pending_confirmation',
            createdAt: new Date().toISOString()
        };

        mockBookings.set(bookingId, booking);

        // Emit real-time update
        io.emit('update-seat-status', {
            seatId: seatId,
            status: 'pending_confirmation',
            timestamp: Date.now()
        });

        res.json({
            success: true,
            message: 'Оплата подтверждена. Ожидайте подтверждения администратора.',
            bookingId: bookingId,
            status: 'pending_confirmation'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin confirmation endpoint
app.post('/api/confirm-payment', async (req, res) => {
    const { bookingId } = req.body;
    console.log('🔍 Admin confirmation request:', { bookingId });

    if (!bookingId) {
        return res.status(400).json({ error: 'bookingId required' });
    }

    const booking = mockBookings.get(bookingId);
    if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'pending_confirmation') {
        return res.status(400).json({ error: 'Booking not in pending_confirmation status' });
    }

    try {
        // Update booking status
        booking.status = 'paid';
        booking.confirmedAt = new Date().toISOString();
        mockBookings.set(bookingId, booking);

        // Emit real-time update
        io.emit('update-seat-status', {
            seatId: booking.seatId,
            status: 'paid',
            timestamp: Date.now()
        });

        res.json({
            success: true,
            message: 'Payment confirmed and ticket sent',
            bookingId: bookingId
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Seat statuses endpoint
app.get('/api/seat-statuses', (req, res) => {
    const seatStatuses = {};
    
    // Initialize all seats as available
    for (let table = 1; table <= 36; table++) {
        for (let seat = 1; seat <= 14; seat++) {
            const seatId = `${table}-${seat}`;
            seatStatuses[seatId] = 'active';
        }
    }
    
    // Update with booking statuses
    mockBookings.forEach(booking => {
        if (booking.status === 'paid') {
            seatStatuses[booking.seatId] = 'reserved';
        } else if (booking.status === 'pending_confirmation') {
            seatStatuses[booking.seatId] = 'pending';
        }
    });
    
    res.json({
        success: true,
        seatStatuses: seatStatuses,
        timestamp: new Date().toISOString()
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log('🚀 Minimal server started successfully!');
    console.log(`🌐 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO Server: ws://localhost:${PORT}/socket.io/`);
    console.log('📱 Admin panel: http://localhost:3000/admin.html');
    console.log('🎓 Student portal: http://localhost:3000/index.html');
});
