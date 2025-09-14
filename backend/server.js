const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const { Blob } = require('buffer');
const { FormData } = require('undici');
const config = require('./config');
const SecureTicketSystem = require('./secure-ticket-system');
const db = require('./database');

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
app.use(express.json());
app.use(express.static('.'));
// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure tickets directory exists
const ticketsDir = path.join(__dirname, 'tickets');
fs.ensureDirSync(ticketsDir);

// Green API configuration
const GREEN_API_URL = config.whatsapp.apiUrl;
const GREEN_API_ID = config.whatsapp.id;
const GREEN_API_TOKEN = config.whatsapp.token;

// Initialize Secure Ticket System
const secureTicketSystem = new SecureTicketSystem(
    config.tickets?.secretKey || 'default-secret-key-change-in-production',
    path.join(__dirname, 'secure-tickets-database.json')
);

// Initialize database
async function initializeApp() {
    try {
        await db.initializeDatabase();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

// Function to emit seat updates to all connected clients
async function emitSeatUpdate() {
    try {
        // Get current seat statuses
        const seatStatuses = {};
        
        // Initialize all seats as available (active) - using correct table count
        for (let table = 1; table <= 36; table++) {
            for (let seat = 1; seat <= 14; seat++) {
                const seatId = `${table}-${seat}`;
                seatStatuses[seatId] = 'active'; // default to available
            }
        }
        
        // Load bookings from database and update seat statuses
        const bookings = await db.getSeatStatuses();
        
        // Update seat statuses based on bookings
        bookings.forEach(booking => {
            if (booking.table_number && booking.seat_number && booking.status) {
                const seatId = `${booking.table_number}-${booking.seat_number}`;
                let status = 'active'; // default
                
                if (booking.status === 'paid' || booking.status === 'confirmed') {
                    status = 'reserved';
                } else if (booking.status === 'pending') {
                    status = 'pending';
                } else if (booking.status === 'prebooked') {
                    status = 'paid'; // Pre-booked seats appear as "Booked (Paid)" for students
                }
                
                seatStatuses[seatId] = status;
                console.log(`📊 Server: Seat ${seatId} status set to ${status} (booking status: ${booking.status})`);
            }
        });
        
        // Count statuses for logging
        const statusCounts = Object.values(seatStatuses).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        // Emit to all connected clients
        const updateData = {
            success: true,
            seatStatuses: seatStatuses,
            timestamp: Date.now(),
            totalSeats: Object.keys(seatStatuses).length,
            statusCounts: statusCounts
        };
        
        // Emit seat update to ALL connected clients (both admins and students)
        console.log('📡 Emitting seatUpdate event to all clients...');
        io.emit('seatUpdate', updateData);
        
        console.log('📡 Emitting update-seat-status event to all clients...');
        io.emit('update-seat-status', updateData);
        
        // Also emit specifically to admins room for admin-specific updates
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        if (adminCount > 0) {
            console.log(`📡 Emitting admin:seat-update event to ${adminCount} admin clients...`);
            io.to('admins').emit('admin:seat-update', {
                ...updateData,
                adminNotification: true
            });
        }
        
        console.log('✅ Seat update events emitted successfully');
        console.log(`📊 Total connected clients: ${io.engine.clientsCount}`);
        console.log(`📊 Admin clients in room: ${adminCount}`);
        console.log(`📊 Event data:`, {
            success: updateData.success,
            totalSeats: updateData.totalSeats,
            statusCounts: updateData.statusCounts,
            timestamp: new Date(updateData.timestamp).toISOString()
        });
        
        console.log(`📡 Seat update emitted to ${io.engine.clientsCount} connected clients`);
        console.log(`📊 Total seats: ${Object.keys(seatStatuses).length}`);
        console.log(`📊 Status distribution:`, statusCounts);
    } catch (error) {
        console.error('Error emitting seat update:', error);
    }
}

// Socket.IO connection handling with role-based access control
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    console.log('📊 Total connected clients:', io.engine.clientsCount);
    console.log('🌐 Client transport:', socket.conn.transport.name);
    
    // Initialize socket data with default role
    socket.data.role = 'student'; // Default role
    socket.data.authenticated = false;
    
    // Send initial connection confirmation
    socket.emit('connected', {
        message: 'Connected to server successfully',
        socketId: socket.id,
        timestamp: new Date().toISOString(),
        serverTime: Date.now(),
        requiresAuth: true
    });
    
    // Send initial seat data to newly connected client
    setTimeout(() => {
        console.log('📡 Sending initial seat data to new client:', socket.id);
        emitSeatUpdate();
    }, 100);
    
    socket.on('disconnect', (reason) => {
        console.log('❌ Client disconnected:', socket.id, 'Reason:', reason);
        console.log('📊 Total connected clients:', io.engine.clientsCount);
    });
    
    // Handle role authentication and room assignment
    socket.on('authenticate', (data) => {
        const { role, password } = data;
        
        if (role === 'admin' && password === 'admin123') {
            socket.data.role = 'admin';
            socket.data.authenticated = true;
            
            // Join admin to the unified admins room
            socket.join('admins');
            console.log('✅ Admin authenticated and joined admins room:', socket.id);
            console.log('📊 Admins in room:', io.sockets.adapter.rooms.get('admins')?.size || 0);
            
            socket.emit('authSuccess', { 
                role: 'admin', 
                message: 'Admin authentication successful',
                room: 'admins'
            });
        } else if (role === 'student') {
            socket.data.role = 'student';
            socket.data.authenticated = true;
            console.log('✅ Student authenticated:', socket.id);
            socket.emit('authSuccess', { role: 'student', message: 'Student authentication successful' });
        } else {
            console.log('❌ Authentication failed:', socket.id, 'Role:', role);
            socket.emit('authError', { message: 'Invalid credentials' });
        }
    });
    
    // Handle identify event for room assignment (backup method)
    socket.on('identify', (payload) => {
        if (payload && payload.role === 'admin' && socket.data.authenticated) {
            socket.join('admins');
            console.log(`🔗 Socket ${socket.id} joined admins room via identify`);
            console.log('📊 Admins in room:', io.sockets.adapter.rooms.get('admins')?.size || 0);
        }
    });
    
    // Handle test events from clients
    socket.on('test', (data) => {
        console.log('🧪 Test event received from client:', socket.id, 'Role:', socket.data.role);
        // Echo back the test event
        socket.emit('test', {
            message: 'Test response from server',
            originalData: data,
            timestamp: new Date().toISOString(),
            serverId: 'server-' + Date.now(),
            userRole: socket.data.role
        });
    });
    
    // Handle client requesting seat data (allowed for all roles)
    socket.on('requestSeatData', () => {
        console.log('📡 Client requesting seat data:', socket.id, 'Role:', socket.data.role);
        emitSeatUpdate();
    });
    
    // Handle seat selection events (allowed for all roles)
    socket.on('seatSelection', (data) => {
        console.log('📡 Seat selection event:', data.seatId, 'Status:', data.status, 'From client:', socket.id);
        
        // Emit to all clients except the sender
        socket.broadcast.emit('seatSelection', {
            seatId: data.seatId,
            status: data.status,
            timestamp: data.timestamp,
            fromClient: socket.id
        });
        
        console.log(`📡 Seat selection broadcasted to ${io.engine.clientsCount - 1} other clients`);
    });
    
    // Handle seat modification events (admin only)
    socket.on('modifySeat', (data) => {
        if (socket.data.role !== 'admin' || !socket.data.authenticated) {
            console.log('🚫 Unauthorized seat modification attempt:', socket.id, 'Role:', socket.data.role);
            socket.emit('error', { message: 'Unauthorized: Only admins can modify seats' });
            return;
        }
        
        console.log('✅ Admin seat modification:', socket.id, data);
        // Process seat modification here
        socket.emit('seatModified', { success: true, data });
    });
    
    // Handle booking events (admin only)
    socket.on('createBooking', (data) => {
        if (socket.data.role !== 'admin' || !socket.data.authenticated) {
            console.log('🚫 Unauthorized booking attempt:', socket.id, 'Role:', socket.data.role);
            socket.emit('error', { message: 'Unauthorized: Only admins can create bookings' });
            return;
        }
        
        console.log('✅ Admin booking creation:', socket.id, data);
        // Process booking creation here
        socket.emit('bookingCreated', { success: true, data });
    });
    
    // Handle bulk seat release (admin only)
    socket.on('admin:releaseAllSeats', (data) => {
        if (socket.data.role !== 'admin' || !socket.data.authenticated) {
            console.log('🚫 Unauthorized bulk seat release attempt:', socket.id, 'Role:', socket.data.role);
            socket.emit('error', { message: 'Unauthorized: Only admins can release all seats' });
            return;
        }
        
        console.log('🔄 Admin releasing all seats:', socket.id);
        releaseAllSeats();
    });
    
    // Handle seat pre-booking (admin only)
    socket.on('admin:prebookSeats', (data) => {
        if (socket.data.role !== 'admin' || !socket.data.authenticated) {
            console.log('🚫 Unauthorized seat pre-booking attempt:', socket.id, 'Role:', socket.data.role);
            socket.emit('error', { message: 'Unauthorized: Only admins can pre-book seats' });
            return;
        }
        
        const { seatIds, prebookType = 'manual' } = data;
        
        if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            console.log('❌ Invalid pre-booking data:', socket.id, data);
            socket.emit('error', { message: 'Invalid seat IDs provided for pre-booking' });
            return;
        }
        
        console.log('🔄 Admin pre-booking seats:', socket.id, 'Seats:', seatIds, 'Type:', prebookType);
        prebookSeats(seatIds, prebookType);
    });
    
    // Handle client pings
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });
    
    // Handle booking creation events (broadcast to all admins)
    socket.on('booking-created', (data) => {
        console.log('📡 Booking created event received:', data);
        
        // Broadcast to all admins in the admins room
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        io.to('admins').emit('update-seat-status', {
            type: 'booking-created',
            data: data,
            timestamp: Date.now()
        });
        
        // Also emit seat update to refresh all clients
        emitSeatUpdate();
        
        console.log(`📡 Booking created broadcasted to ${adminCount} admin clients in admins room`);
    });
});

// Function to release all seats and emit bulk update
function releaseAllSeats() {
    try {
        console.log('🔄 Releasing all seats...');
        
        // Clear all bookings
        const bookingsPath = path.join(__dirname, 'bookings.json');
        const emptyBookings = {};
        
        fs.writeFileSync(bookingsPath, JSON.stringify(emptyBookings, null, 2));
        console.log('✅ All bookings cleared from database');
        
        // Emit bulk seat update to all clients
        emitSeatBulkUpdate();
        
        console.log('📡 Bulk seat update emitted to all connected clients');
    } catch (error) {
        console.error('Error releasing all seats:', error);
    }
}

// Function to emit bulk seat update to all connected clients
function emitSeatBulkUpdate() {
    try {
        // Get current seat statuses
        const seatStatuses = {};
        
        // Initialize all seats as available (active)
        for (let table = 1; table <= 36; table++) {
            for (let seat = 1; seat <= 14; seat++) {
                const seatId = `${table}-${seat}`;
                seatStatuses[seatId] = 'active'; // default to available
            }
        }
        
        // Load current bookings and update seat statuses
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        // Update seat statuses based on bookings
        Object.values(bookings).forEach(booking => {
            if (booking.table && booking.seat && booking.status) {
                const seatId = `${booking.table}-${booking.seat}`;
                let status = 'active'; // default
                
                if (booking.status === 'paid' || booking.status === 'confirmed' || booking.status === 'paid_ru') {
                    status = 'reserved';
                } else if (booking.status === 'pending') {
                    status = 'pending';
                } else if (booking.status === 'prebooked') {
                    status = 'paid'; // Pre-booked seats appear as "Booked (Paid)" for students
                }
                
                seatStatuses[seatId] = status;
                console.log(`📊 Server: Seat ${seatId} status set to ${status} (booking status: ${booking.status})`);
            }
        });
        
        // Calculate status counts
        const statusCounts = Object.values(seatStatuses).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        
        const bulkUpdateData = {
            success: true,
            seatStatuses: seatStatuses,
            timestamp: Date.now(),
            totalSeats: Object.keys(seatStatuses).length,
            statusCounts: statusCounts,
            type: 'bulk_update',
            message: 'All seats released - bulk update'
        };
        
        // Emit bulk update to all connected clients
        io.emit('seatBulkUpdate', bulkUpdateData);
        
        console.log(`📡 Bulk seat update emitted to ${io.engine.clientsCount} connected clients`);
        console.log(`📊 Total seats: ${Object.keys(seatStatuses).length}`);
        console.log(`📊 Status distribution:`, statusCounts);
        console.log(`🔄 All seats set to available status`);
    } catch (error) {
        console.error('Error emitting bulk seat update:', error);
    }
}

// Function to pre-book specific seats
function prebookSeats(seatIds, prebookType = 'manual') {
    try {
        console.log('🔄 Pre-booking seats:', seatIds, 'Type:', prebookType);
        
        // Load current bookings
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        // Pre-book each seat
        const prebookedSeats = [];
        const alreadyBookedSeats = [];
        
        seatIds.forEach(seatId => {
            // Check if seat is already booked
            const existingBooking = Object.values(bookings).find(booking => {
                const bookingSeatId = `${booking.table}-${booking.seat}`;
                return bookingSeatId === seatId && booking.status !== 'cancelled';
            });
            
            if (existingBooking) {
                alreadyBookedSeats.push(seatId);
                console.log(`⚠️ Seat ${seatId} is already booked`);
                return;
            }
            
            // Create pre-booking entry
            const bookingId = 'prebook_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const [table, seat] = seatId.split('-');
            
            bookings[bookingId] = {
                id: bookingId,
                table: parseInt(table),
                seat: parseInt(seat),
                firstName: 'PREBOOKED',
                lastName: prebookType.toUpperCase(),
                studentId: 'PREBOOK',
                phone: '0000000000',
                email: 'prebook@system.local',
                status: 'prebooked',
                timestamp: Date.now(),
                prebookType: prebookType,
                adminAction: true
            };
            
            prebookedSeats.push(seatId);
            console.log(`✅ Pre-booked seat ${seatId}`);
        });
        
        // Save updated bookings
        fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
        console.log(`💾 Updated bookings database with ${prebookedSeats.length} pre-booked seats`);
        
        // Emit bulk update to all clients
        emitSeatBulkUpdate();
        
        // Send confirmation to admin
        const result = {
            success: true,
            prebookedSeats: prebookedSeats,
            alreadyBookedSeats: alreadyBookedSeats,
            totalPrebooked: prebookedSeats.length,
            totalAlreadyBooked: alreadyBookedSeats.length,
            prebookType: prebookType,
            timestamp: Date.now()
        };
        
        // Emit to all clients (admin and students)
        io.emit('admin:prebookResult', result);
        
        // Also emit a specific bulk update for pre-booking
        const prebookBulkUpdate = {
            success: true,
            type: 'prebook_update',
            message: `Pre-booked ${prebookedSeats.length} seats (${prebookType})`,
            prebookedSeats: prebookedSeats,
            prebookType: prebookType,
            timestamp: Date.now()
        };
        
        io.emit('seatBulkUpdate', prebookBulkUpdate);
        
        console.log(`📡 Pre-booking result emitted to all clients`);
        console.log(`📊 Pre-booked: ${prebookedSeats.length}, Already booked: ${alreadyBookedSeats.length}`);
        
    } catch (error) {
        console.error('Error pre-booking seats:', error);
        
        // Send error to admin
        io.emit('admin:prebookResult', {
            success: false,
            error: 'Failed to pre-book seats',
            details: error.message,
            timestamp: Date.now()
        });
    }
}

// Generate QR code
async function generateQRCode(data) {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(data), {
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return qrCodeDataURL;
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw error;
    }
}

// Generate PDF ticket
async function generatePDFTicket(bookingData, qrCodeDataURL) {
    try {
        // Create a new PDF document with ticket dimensions (similar to the golden ticket)
        const pdfDoc = await PDFDocument.create();
        
        // Register fontkit for custom font support
        pdfDoc.registerFontkit(fontkit);
        
        const page = pdfDoc.addPage([600, 400]); // Landscape orientation for ticket format
        
        // Load Roboto font for Cyrillic support
        const robotoFontBytes = fs.readFileSync(path.join(__dirname, 'fonts', 'ofont.ru_Roboto.ttf'));
        const robotoFont = await pdfDoc.embedFont(robotoFontBytes);
        
        // Colors - Golden theme
        const goldColor = rgb(0.85, 0.65, 0.13); // Golden color
        const darkGold = rgb(0.7, 0.5, 0.1); // Darker gold
        const textColor = rgb(0.1, 0.1, 0.1); // Very dark text
        const borderColor = rgb(0.6, 0.45, 0.1); // Border color
        
        // Draw golden background gradient effect
        page.drawRectangle({
            x: 0,
            y: 0,
            width: 600,
            height: 400,
            borderColor: borderColor,
            borderWidth: 8,
            color: rgb(0.95, 0.85, 0.4), // Light golden background
        });
        
        // Draw decorative border with corner ornaments
        const borderWidth = 6;
        page.drawRectangle({
            x: borderWidth,
            y: borderWidth,
            width: 600 - (borderWidth * 2),
            height: 400 - (borderWidth * 2),
            borderColor: darkGold,
            borderWidth: 2,
        });
        
        // Draw inner decorative border
        page.drawRectangle({
            x: borderWidth + 15,
            y: borderWidth + 15,
            width: 600 - (borderWidth * 2) - 30,
            height: 400 - (borderWidth * 2) - 30,
            borderColor: goldColor,
            borderWidth: 1,
        });
        
        // Top section - КГМА and GOLDENMIDDLE
        page.drawText('КГМА', {
            x: 300,
            y: 350,
            size: 24,
            font: robotoFont,
            color: textColor,
        });
        
        page.drawText('GOLDENMIDDLE', {
            x: 150,
            y: 320,
            size: 32,
            font: robotoFont,
            color: textColor,
        });
        
        // Event details section
        page.drawText('Date: October 26', {
            x: 50,
            y: 280,
            size: 14,
            font: robotoFont,
            color: textColor,
        });
        
        page.drawText('Time: 18:00', {
            x: 250,
            y: 280,
            size: 14,
            font: robotoFont,
            color: textColor,
        });
        
        page.drawText('Venue: Asman', {
            x: 450,
            y: 280,
            size: 14,
            font: robotoFont,
            color: textColor,
        });
        
        // Decorative line
        page.drawLine({
            start: { x: 50, y: 260 },
            end: { x: 550, y: 260 },
            thickness: 2,
            color: darkGold,
        });
        
        // Student name section
        page.drawText('First and Last Name', {
            x: 250,
            y: 230,
            size: 16,
            font: robotoFont,
            color: textColor,
        });
        
        // Draw line for name
        page.drawLine({
            start: { x: 200, y: 210 },
            end: { x: 400, y: 210 },
            thickness: 1,
            color: textColor,
        });
        
        // Student's actual name
        const fullName = `${bookingData.firstName} ${bookingData.lastName}`;
        page.drawText(fullName, {
            x: 250 - (fullName.length * 3), // Center the name
            y: 190,
            size: 14,
            font: robotoFont,
            color: textColor,
        });
        
        // Bottom section with QR code and seat info
        // QR Code section (right side as requested)
        if (qrCodeDataURL) {
            try {
                // Convert data URL to buffer
                const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
                const qrBuffer = Buffer.from(base64Data, 'base64');
                const qrImage = await pdfDoc.embedPng(qrBuffer);
                
                // Draw QR code on the right side
                page.drawImage(qrImage, {
                    x: 400,
                    y: 80,
                    width: 120,
                    height: 120,
                });
                
            } catch (error) {
                console.error('Error embedding QR code:', error);
                // Fallback: draw "QR" text if QR code fails
                page.drawText('QR', {
                    x: 440,
                    y: 130,
                    size: 48,
                    font: robotoFont,
                    color: textColor,
                });
            }
        } else {
            // Fallback: draw "QR" text
            page.drawText('QR', {
                x: 440,
                y: 130,
                size: 48,
                font: robotoFont,
                color: textColor,
            });
        }
        
        // Seat information section (left side as requested)
        page.drawText('Table and Seat Number', {
            x: 80,
            y: 150,
            size: 14,
            font: robotoFont,
            color: textColor,
        });
        
        // Draw line for seat info
        page.drawLine({
            start: { x: 30, y: 130 },
            end: { x: 180, y: 130 },
            thickness: 1,
            color: textColor,
        });
        
        // Student's actual seat information
        const seatInfo = `Table ${bookingData.table}, Seat ${bookingData.seat}`;
        page.drawText(seatInfo, {
            x: 80 - (seatInfo.length * 2.5), // Center the seat info
            y: 110,
            size: 12,
            font: robotoFont,
            color: textColor,
        });
        
        // Add ticket ID in small text at bottom
        page.drawText(`ID: ${bookingData.ticketId || bookingData.id}`, {
            x: 10,
            y: 20,
            size: 8,
            font: robotoFont,
            color: rgb(0.5, 0.5, 0.5),
        });
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

// Send WhatsApp ticket
async function sendWhatsAppTicket(phone, pdfBytes, ticketId, bookingData) {
    try {
        console.log(`📱 Starting WhatsApp ticket sending for ${bookingData.firstName} ${bookingData.lastName} (${phone})`);
        
        const phoneNumber = phone.replace(/[^\d]/g, '');
        const chatId = `${phoneNumber}@c.us`;

        console.log(`📞 Processed phone number: ${phoneNumber}`);
        console.log(`💬 Chat ID: ${chatId}`);

        // Send message first
        const messageData = {
            chatId: chatId,
            message: `🎫 Hello, ${bookingData.firstName}!\n\nYour golden ticket for GOLDENMIDDLE is ready!\n\n📅 Date: October 26\n⏰ Time: 18:00\n📍 Venue: Asman\n🪑 Your seat: Table ${bookingData.table}, Seat ${bookingData.seat}\n💵 Price: 5500 Som\n🆔 Ticket ID: ${ticketId}\n\nTicket is attached. Show it at the event entrance!`
        };

        console.log('📤 Sending text message...');
        const messageResponse = await axios.post(
            `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`,
            messageData
        );

        if (!messageResponse.data.idMessage) {
            throw new Error('Failed to send WhatsApp message - no message ID returned');
        }

        console.log('✅ WhatsApp message sent successfully, ID:', messageResponse.data.idMessage);

        // Send the PDF file using undici's FormData
        console.log('📄 Preparing PDF file for sending...');
        console.log(`📊 PDF size: ${pdfBytes.length} bytes`);
        
        const formData = new FormData();
        formData.append('chatId', chatId);
        
        // Convert PDF buffer to Blob for undici FormData compatibility
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        console.log(`📄 Blob created: type=${pdfBlob.type}, size=${pdfBlob.size} bytes`);
        
        formData.append('file', pdfBlob, 'ticket.pdf');
        console.log('✅ PDF file added to FormData');

        console.log('📤 Sending PDF file via WhatsApp API...');
        const fileResponse = await axios.post(
            `${GREEN_API_URL}/waInstance${GREEN_API_ID}/sendFileByUpload/${GREEN_API_TOKEN}`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        );

        if (!fileResponse.data.idMessage) {
            throw new Error('Failed to send WhatsApp file - no message ID returned');
        }

        console.log('✅ WhatsApp ticket sent successfully!');
        console.log(`📱 Recipient: ${phone}`);
        console.log(`🎫 Ticket ID: ${ticketId}`);
        console.log(`📄 File ID: ${fileResponse.data.idMessage}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error sending WhatsApp ticket:', error.message);
        console.error('📄 Error details:', {
            phone: phone,
            ticketId: ticketId,
            bookingName: `${bookingData.firstName} ${bookingData.lastName}`,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}


// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    try {
        // Check if bookings file exists and is readable
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        let databaseStatus = 'healthy';
        
        if (fs.existsSync(bookingsPath)) {
            try {
                const data = fs.readFileSync(bookingsPath, 'utf8');
                bookings = JSON.parse(data);
            } catch (error) {
                databaseStatus = 'error';
                console.error('Error reading bookings file:', error);
            }
        } else {
            // Create empty bookings file if it doesn't exist
            try {
                fs.writeFileSync(bookingsPath, JSON.stringify({}, null, 2));
                databaseStatus = 'healthy';
            } catch (error) {
                databaseStatus = 'error';
                console.error('Error creating bookings file:', error);
            }
        }
        
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version,
                platform: process.platform
            },
            database: {
                status: databaseStatus,
                bookingsCount: Object.keys(bookings).length,
                filePath: bookingsPath,
                exists: fs.existsSync(bookingsPath)
            },
            socket: {
                connectedClients: io.engine.clientsCount,
                rooms: Array.from(io.sockets.adapter.rooms.keys())
            },
            application: {
                name: 'Golden Middle Ticketing System',
                version: '1.0.0',
                totalSeats: 504, // 36 tables * 14 seats
                availableSeats: 504 - Object.values(bookings).filter(b => 
                    b.status === 'paid' || b.status === 'confirmed' || b.status === 'paid_ru' || b.status === 'prebooked'
                ).length
            }
        };
        
        res.status(200).json(healthData);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
            server: {
                uptime: process.uptime(),
                version: process.version
            }
        });
    }
});

// Create new booking
app.post('/api/create-booking', async (req, res) => {
    try {
        const bookingData = req.body;
        
        // Generate unique booking ID
        const bookingId = 'BK' + Date.now().toString(36).toUpperCase();
        bookingData.id = bookingId;
        bookingData.status = 'pending';
        bookingData.bookingDate = new Date().toISOString();
        
        // Handle seatId format (e.g., "3-3" -> table: 3, seat: 3)
        if (bookingData.seatId && !bookingData.table) {
            const [table, seat] = bookingData.seatId.split('-');
            bookingData.table = parseInt(table);
            bookingData.seat = parseInt(seat);
        }
        
        // Ensure table and seat are numbers
        if (bookingData.table) {
            bookingData.table = parseInt(bookingData.table);
        }
        if (bookingData.seat) {
            bookingData.seat = parseInt(bookingData.seat);
        }
        
        // Validate required fields
        if (!bookingData.table || !bookingData.seat) {
            console.log('❌ Missing table or seat fields:', bookingData);
            return res.status(400).json({ error: 'Неверный формат места. Требуются table и seat или seatId.' });
        }
        
        // Validate phone number (E.164 format)
        if (!bookingData.phone) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }
        
        const phoneRegex = /^\+\d{8,15}$/;
        if (!phoneRegex.test(bookingData.phone)) {
            return res.status(400).json({ error: 'Invalid phone number format. Please use E.164 format (e.g., +996555123456).' });
        }
        
        console.log('✅ Booking data after parsing:', {
            id: bookingData.id,
            seatId: bookingData.seatId,
            table: bookingData.table,
            seat: bookingData.seat,
            status: bookingData.status
        });
        
        // Check if seat is already booked (only check for confirmed bookings)
        const existingBookings = await db.getSeatStatuses();
        const existingBooking = existingBookings.find(b => 
            b.table_number == bookingData.table && b.seat_number == bookingData.seat && 
            (b.status === 'paid' || b.status === 'confirmed' || b.status === 'prebooked')
        );
        
        if (existingBooking) {
            return res.status(400).json({ error: 'Seat already booked' });
        }
        
        // Create or update user
        await db.createOrUpdateUser(
            bookingData.phone,
            bookingData.firstName,
            bookingData.lastName,
            bookingData.email
        );
        
        // Save booking to database
        await db.createBooking({
            bookingId: bookingId,
            userPhone: bookingData.phone,
            firstName: bookingData.firstName,
            lastName: bookingData.lastName,
            tableNumber: bookingData.table,
            seatNumber: bookingData.seat,
            status: 'pending'
        });
        
        // Emit booking created event to all admins
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        io.to('admins').emit('update-seat-status', {
            type: 'booking-created',
            data: {
                bookingId: bookingId,
                table: bookingData.table,
                seat: bookingData.seat,
                status: bookingData.status,
                firstName: bookingData.firstName,
                lastName: bookingData.lastName
            },
            timestamp: Date.now()
        });
        
        // Emit individual seat status update
        const seatId = `${bookingData.table}-${bookingData.seat}`;
        io.emit('update-seat-status', {
            seatId: seatId,
            status: 'pending',
            timestamp: Date.now()
        });
        
        console.log(`📡 API booking created broadcasted to ${adminCount} admin clients in admins room`);
        
        // Emit seat update to all connected clients
        emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Бронирование создано успешно',
            bookingId: bookingId
        });
        
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Ошибка при создании бронирования' });
    }
});

// Confirm payment and generate ticket
app.post('/api/confirm-payment', async (req, res) => {
    try {
        const { bookingId } = req.body;
        
        // Load bookings from localStorage (in a real app, this would be a database)
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        const booking = bookings[bookingId];
        if (!booking) {
            return res.status(404).json({ error: 'Бронирование не найдено' });
        }
        
        // Update booking status
        booking.status = 'Оплачен';
        booking.paymentDate = new Date().toISOString();
        booking.paymentConfirmedBy = 'admin';
        
        // Generate unique ticket ID
        const ticketId = `TK${Date.now().toString(36).toUpperCase()}`;
        booking.ticketId = ticketId;
        
        // Generate QR code data
        const qrData = {
            ticketId: ticketId,
            bookingId: booking.id,
            seatId: `${booking.table}-${booking.seat}`,
            event: 'GOLDENMIDDLE',
            organization: 'КГМА',
            date: '2025-10-26',
            time: '18:00',
            venue: 'Асман',
            name: `${booking.firstName} ${booking.lastName}`,
            seat: `Стол ${booking.table}, Место ${booking.seat}`,
            timestamp: Date.now()
        };
        
        // Generate QR code
        const qrCodeDataURL = await generateQRCode(qrData);
        
        // Generate PDF ticket
        const pdfBuffer = await generatePDFTicket(booking, qrCodeDataURL);
        
        // Save PDF to tickets folder
        const ticketFileName = `${ticketId}.pdf`;
        const ticketPath = path.join(ticketsDir, ticketFileName);
        fs.writeFileSync(ticketPath, pdfBuffer);
        
        // Send WhatsApp ticket
        await sendWhatsAppTicket(booking.phone, pdfBuffer, ticketId, booking);
        
        // Update bookings
        bookings[bookingId] = booking;
        fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
        
        // Emit payment confirmed event to all admins
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        io.to('admins').emit('update-seat-status', {
            type: 'payment-confirmed',
            data: {
                bookingId: bookingId,
                table: booking.table,
                seat: booking.seat,
                status: booking.status,
                firstName: booking.firstName,
                lastName: booking.lastName,
                ticketId: ticketId
            },
            timestamp: Date.now()
        });
        
        // Emit individual seat status update
        const seatId = `${booking.table}-${booking.seat}`;
        io.emit('update-seat-status', {
            seatId: seatId,
            status: 'booked',
            timestamp: Date.now()
        });
        
        console.log(`📡 Payment confirmed broadcasted to ${adminCount} admin clients in admins room`);
        
        // Emit seat update to all connected clients
        emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Оплата подтверждена и билет отправлен в WhatsApp',
            ticketId: ticketId,
            ticketPath: `/tickets/${ticketFileName}`
        });
        
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Ошибка при подтверждении оплаты' });
    }
});

// Delete booking
app.delete('/api/delete-booking/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        // Load bookings
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        const booking = bookings[bookingId];
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Delete ticket file if exists
        if (booking.ticketId) {
            const ticketPath = path.join(ticketsDir, `${booking.ticketId}.pdf`);
            if (fs.existsSync(ticketPath)) {
                fs.unlinkSync(ticketPath);
            }
        }
        
        // Store booking data before deletion for event emission
        const deletedBooking = { ...booking };
        
        // Remove booking
        delete bookings[bookingId];
        fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
        
        // Emit booking deleted event to all admins
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        io.to('admins').emit('update-seat-status', {
            type: 'booking-deleted',
            data: {
                bookingId: bookingId,
                table: deletedBooking.table,
                seat: deletedBooking.seat,
                status: 'available',
                firstName: deletedBooking.firstName,
                lastName: deletedBooking.lastName
            },
            timestamp: Date.now()
        });
        
        // Emit individual seat status update
        const seatId = `${deletedBooking.table}-${deletedBooking.seat}`;
        io.emit('update-seat-status', {
            seatId: seatId,
            status: 'available',
            timestamp: Date.now()
        });
        
        console.log(`📡 Booking deleted broadcasted to ${adminCount} admin clients in admins room`);
        
        // Emit seat update to all connected clients
        emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Бронирование удалено'
        });
        
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Ошибка при удалении бронирования' });
    }
});

// Get bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await db.getAllBookings();
        
        // Convert to the format expected by frontend
        const formattedBookings = {};
        bookings.forEach(booking => {
            formattedBookings[booking.booking_id] = {
                id: booking.booking_id,
                firstName: booking.first_name,
                lastName: booking.last_name,
                phone: booking.user_phone,
                email: booking.email,
                table: booking.table_number,
                seat: booking.seat_number,
                status: booking.status,
                bookingDate: booking.booking_date,
                paymentDate: booking.payment_date
            };
        });
        
        res.json(formattedBookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
        res.status(500).json({ error: 'Ошибка при загрузке бронирований' });
    }
});

// Sync bookings from localStorage (for existing bookings)
app.post('/api/sync-bookings', async (req, res) => {
    try {
        const { bookings } = req.body;
        
        if (!bookings || typeof bookings !== 'object') {
            return res.status(400).json({ error: 'Неверный формат данных бронирований' });
        }
        
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let serverBookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            serverBookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        let syncedCount = 0;
        
        // Merge bookings from localStorage
        for (const [bookingId, booking] of Object.entries(bookings)) {
            if (!serverBookings[bookingId]) {
                serverBookings[bookingId] = booking;
                syncedCount++;
            }
        }
        
        // Save updated bookings
        fs.writeFileSync(bookingsPath, JSON.stringify(serverBookings, null, 2));
        
        res.json({
            success: true,
            message: `Синхронизировано ${syncedCount} бронирований`,
            syncedCount: syncedCount
        });
        
    } catch (error) {
        console.error('Error syncing bookings:', error);
        res.status(500).json({ error: 'Ошибка при синхронизации бронирований' });
    }
});

// Serve ticket files
app.get('/tickets/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(ticketsDir, filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Файл билета не найден' });
    }
});

// ===== HEALTHCHECK ENDPOINTS =====

// Basic healthcheck
app.get('/api/health', async (req, res) => {
    try {
        // Check database connectivity
        const dbHealthy = await db.checkDatabaseHealth();
        
        // Check secure ticket system
        const secureTicketsPath = path.join(__dirname, 'secure-tickets-database.json');
        const secureTicketsHealthy = fs.existsSync(secureTicketsPath);
        
        res.json({
            status: 'ok',
            uptime_seconds: Math.floor(process.uptime()),
            db: dbHealthy,
            secure_tickets: secureTicketsHealthy,
            version: process.env.GIT_COMMIT_SHORT || 'dev'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            uptime_seconds: Math.floor(process.uptime()),
            error: error.message
        });
    }
});

// Readiness healthcheck
app.get('/api/health/readiness', (req, res) => {
    try {
        // Check if all required services are ready
        const bookingsPath = path.join(__dirname, 'bookings.json');
        const secureTicketsPath = path.join(__dirname, 'secure-tickets-database.json');
        
        const dbReady = fs.existsSync(bookingsPath);
        const secureTicketsReady = fs.existsSync(secureTicketsPath);
        
        if (dbReady && secureTicketsReady) {
            res.json({
                status: 'healthy',
                ready: true,
                services: {
                    database: true,
                    secure_tickets: true
                }
            });
        } else {
            res.status(503).json({
                status: 'unhealthy',
                ready: false,
                services: {
                    database: dbReady,
                    secure_tickets: secureTicketsReady
                }
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'error',
            ready: false,
            error: error.message
        });
    }
});

// ===== PAYMENT SYSTEM API ENDPOINTS =====

// Create payment record
app.post('/api/payments/create', async (req, res) => {
    try {
        const { bookingId, amount, currency = 'Som' } = req.body;
        
        // Generate transaction ID
        const transactionId = 'TXN' + Date.now().toString(36).toUpperCase();
        
        // Create payment record
        const payment = {
            id: transactionId,
            transaction_id: transactionId,
            booking_id: bookingId,
            amount: amount || 5500,
            currency: currency,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            provider: 'manual',
            raw_payload: {}
        };
        
        // Save payment to file (in production, use a proper database)
        const paymentsPath = path.join(__dirname, 'payments.json');
        let payments = {};
        
        if (fs.existsSync(paymentsPath)) {
            payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
        }
        
        payments[transactionId] = payment;
        fs.writeFileSync(paymentsPath, JSON.stringify(payments, null, 2));
        
        res.json({
            success: true,
            transaction_id: transactionId,
            status: 'pending',
            amount: payment.amount,
            currency: payment.currency
        });
        
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Error creating payment' });
    }
});

// Get payment status
app.get('/api/payments/:transaction_id/status', (req, res) => {
    try {
        const { transaction_id } = req.params;
        const paymentsPath = path.join(__dirname, 'payments.json');
        
        if (!fs.existsSync(paymentsPath)) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        const payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
        const payment = payments[transaction_id];
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        res.json({
            transaction_id: transaction_id,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            created_at: payment.created_at,
            updated_at: payment.updated_at
        });
        
    } catch (error) {
        console.error('Error getting payment status:', error);
        res.status(500).json({ error: 'Error getting payment status' });
    }
});

// Payment webhook (for external payment providers)
app.post('/api/payments/webhook', async (req, res) => {
    try {
        const { transaction_id, status, amount, currency } = req.body;
        
        console.log('📞 Payment webhook received:', { transaction_id, status, amount, currency });
        
        // Load payments
        const paymentsPath = path.join(__dirname, 'payments.json');
        let payments = {};
        
        if (fs.existsSync(paymentsPath)) {
            payments = JSON.parse(fs.readFileSync(paymentsPath, 'utf8'));
        }
        
        const payment = payments[transaction_id];
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        // Update payment status
        payment.status = status;
        payment.updated_at = new Date().toISOString();
        payment.raw_payload = req.body;
        
        payments[transaction_id] = payment;
        fs.writeFileSync(paymentsPath, JSON.stringify(payments, null, 2));
        
        // If payment is confirmed, update booking status and send ticket
        if (status === 'confirmed' || status === 'paid') {
            const bookingId = payment.booking_id;
            
            // Load bookings
            const bookingsPath = path.join(__dirname, 'bookings.json');
            let bookings = {};
            
            if (fs.existsSync(bookingsPath)) {
                bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
            }
            
            const booking = bookings[bookingId];
            if (booking) {
                // Update booking status
                booking.status = 'paid_ru';
                booking.payment_confirmed_at = new Date().toISOString();
                booking.transaction_id = transaction_id;
                
                bookings[bookingId] = booking;
                fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
                
                // Generate and send ticket
                try {
                    const ticketId = 'TKT' + Date.now().toString(36).toUpperCase();
                    const pdfBytes = await generateTicketPDF(booking, ticketId);
                    const ticketFileName = `ticket_${ticketId}.pdf`;
                    const ticketPath = path.join(ticketsDir, ticketFileName);
                    
                    fs.writeFileSync(ticketPath, pdfBytes);
                    
                    // Send WhatsApp ticket
                    await sendWhatsAppTicket(booking.phone, pdfBytes, ticketId, booking);
                    
                    console.log('✅ Payment confirmed and ticket sent for booking:', bookingId);
                } catch (ticketError) {
                    console.error('❌ Error generating/sending ticket:', ticketError);
                }
            }
        }
        
        res.json({ success: true, message: 'Webhook processed' });
        
    } catch (error) {
        console.error('Error processing payment webhook:', error);
        res.status(500).json({ error: 'Error processing webhook' });
    }
});

// Manual payment confirmation (for admin use)
app.post('/api/payments/:transaction_id/confirm', async (req, res) => {
    try {
        const { transaction_id } = req.params;
        
        // Simulate webhook call
        const webhookData = {
            transaction_id: transaction_id,
            status: 'confirmed',
            amount: 5500,
            currency: 'Som'
        };
        
        // Call the webhook endpoint internally
        const webhookReq = {
            body: webhookData
        };
        
        const webhookRes = {
            json: (data) => {
                res.json(data);
            },
            status: (code) => ({
                json: (data) => res.status(code).json(data)
            })
        };
        
        await app._router.handle(webhookReq, webhookRes, () => {});
        
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Error confirming payment' });
    }
});

// ===== ADMIN FEATURES =====

// Delete ticket (admin only)
app.delete('/admin/tickets/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { adminId = 'admin' } = req.body; // In production, get from auth
        
        // Load bookings to find the ticket
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        // Find booking by ticket ID or booking ID
        const booking = Object.values(bookings).find(b => 
            b.id === ticketId || b.ticketId === ticketId
        );
        
        if (!booking) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Log admin action
        const adminActionsPath = path.join(__dirname, 'admin_actions.json');
        let adminActions = {};
        
        if (fs.existsSync(adminActionsPath)) {
            adminActions = JSON.parse(fs.readFileSync(adminActionsPath, 'utf8'));
        }
        
        const actionId = 'ACT' + Date.now().toString(36).toUpperCase();
        const adminAction = {
            id: actionId,
            admin_id: adminId,
            action: 'delete_ticket',
            ticket_id: ticketId,
            booking_id: booking.id,
            timestamp: new Date().toISOString(),
            details: {
                customer_name: `${booking.firstName} ${booking.lastName}`,
                phone: booking.phone,
                seat: `Table ${booking.table}, Seat ${booking.seat}`,
                status: booking.status,
                amount: booking.price
            }
        };
        
        adminActions[actionId] = adminAction;
        fs.writeFileSync(adminActionsPath, JSON.stringify(adminActions, null, 2));
        
        // Delete the booking
        delete bookings[booking.id];
        fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 2));
        
        // Emit seat update
        emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Ticket deleted successfully',
            action_id: actionId,
            deleted_booking: {
                id: booking.id,
                customer: `${booking.firstName} ${booking.lastName}`,
                seat: `Table ${booking.table}, Seat ${booking.seat}`
            }
        });
        
    } catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ error: 'Error deleting ticket' });
    }
});

// Get admin actions (audit log)
app.get('/admin/actions', (req, res) => {
    try {
        const adminActionsPath = path.join(__dirname, 'admin_actions.json');
        
        if (!fs.existsSync(adminActionsPath)) {
            return res.json([]);
        }
        
        const adminActions = JSON.parse(fs.readFileSync(adminActionsPath, 'utf8'));
        const actionsArray = Object.values(adminActions).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        res.json(actionsArray);
        
    } catch (error) {
        console.error('Error getting admin actions:', error);
        res.status(500).json({ error: 'Error getting admin actions' });
    }
});

// ===== SECURE TICKET SYSTEM API ENDPOINTS =====

// Generate a secure ticket
app.post('/api/secure-tickets/generate', async (req, res) => {
    try {
        const { holderName, table, seat, eventId, eventName, eventDate, eventTime, eventVenue, price, currency } = req.body;
        
        if (!holderName || !table || !seat) {
            return res.status(400).json({ 
                error: 'Missing required fields: holderName, table, seat' 
            });
        }

        const ticketInfo = {
            holderName,
            table,
            seat,
            eventId: eventId || 'GOLDENMIDDLE-2025',
            eventName: eventName || 'GOLDENMIDDLE',
            eventDate: eventDate || '2025-10-26',
            eventTime: eventTime || '18:00',
            eventVenue: eventVenue || 'Асман',
            price: price || 5500,
            currency: currency || 'Сом'
        };

        const result = await secureTicketSystem.createSecureTicket(ticketInfo);
        
        res.json({
            success: true,
            message: 'Secure ticket generated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error generating secure ticket:', error);
        res.status(500).json({ 
            error: 'Failed to generate secure ticket',
            details: error.message 
        });
    }
});

// Verify a ticket from QR code data
app.post('/api/secure-tickets/verify', async (req, res) => {
    try {
        const { qrCodeData } = req.body;
        
        if (!qrCodeData) {
            return res.status(400).json({ 
                error: 'QR code data is required' 
            });
        }

        const verificationResult = await secureTicketSystem.verifyTicket(qrCodeData);
        
        if (verificationResult.valid) {
            res.json({
                success: true,
                message: 'Ticket verified successfully',
                data: verificationResult
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Ticket verification failed',
                error: verificationResult.error,
                data: verificationResult
            });
        }
    } catch (error) {
        console.error('Error verifying ticket:', error);
        res.status(500).json({ 
            error: 'Failed to verify ticket',
            details: error.message 
        });
    }
});

// Mark ticket as used
app.post('/api/secure-tickets/mark-used', async (req, res) => {
    try {
        const { ticketId, usedBy } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({ 
                error: 'Ticket ID is required' 
            });
        }

        await secureTicketSystem.markTicketAsUsed(ticketId, usedBy || 'system');
        
        res.json({
            success: true,
            message: 'Ticket marked as used successfully'
        });
    } catch (error) {
        console.error('Error marking ticket as used:', error);
        res.status(500).json({ 
            error: 'Failed to mark ticket as used',
            details: error.message 
        });
    }
});

// Get all tickets (admin only)
app.get('/api/secure-tickets', (req, res) => {
    try {
        const tickets = secureTicketSystem.getAllTickets();
        const statistics = secureTicketSystem.getTicketStatistics();
        
        res.json({
            success: true,
            data: {
                tickets,
                statistics
            }
        });
    } catch (error) {
        console.error('Error getting all tickets:', error);
        res.status(500).json({ 
            error: 'Failed to get tickets',
            details: error.message 
        });
    }
});

// Get ticket statistics
app.get('/api/secure-tickets/stats', (req, res) => {
    try {
        const statistics = secureTicketSystem.getTicketStatistics();
        
        res.json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Error getting ticket statistics:', error);
        res.status(500).json({ 
            error: 'Failed to get ticket statistics',
            details: error.message 
        });
    }
});

// Get seat statuses for real-time updates
app.get('/api/seat-statuses', (req, res) => {
    try {
        const seatStatuses = {};
        
        // Initialize all seats as available (active) - using correct table count
        for (let table = 1; table <= 36; table++) {
            for (let seat = 1; seat <= 14; seat++) {
                const seatId = `${table}-${seat}`;
                seatStatuses[seatId] = 'active'; // default to available
            }
        }
        
        // Load bookings from file
        const bookingsPath = path.join(__dirname, 'bookings.json');
        let bookings = {};
        
        if (fs.existsSync(bookingsPath)) {
            bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        }
        
        // Get all bookings and their seat statuses
        const allBookings = Object.values(bookings);
        
        allBookings.forEach(booking => {
            if (booking.table && booking.seat && booking.status) {
                const seatId = `${booking.table}-${booking.seat}`;
                let status = 'active'; // default
                
                if (booking.status === 'paid' || booking.status === 'confirmed' || booking.status === 'paid_ru') {
                    status = 'reserved';
                } else if (booking.status === 'pending') {
                    status = 'pending';
                }
                
                seatStatuses[seatId] = status;
                console.log(`📊 Server: Seat ${seatId} status set to ${status} (booking status: ${booking.status})`);
            }
        });
        
        console.log(`📊 Returning seat statuses: ${Object.keys(seatStatuses).length} seats`);
        console.log(`📊 Status distribution:`, Object.values(seatStatuses).reduce((acc, status) => {
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {}));
        
        res.json({
            success: true,
            seatStatuses: seatStatuses,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting seat statuses:', error);
        res.status(500).json({ 
            error: 'Failed to get seat statuses',
            details: error.message 
        });
    }
});

// Get ticket information
app.get('/api/secure-tickets/:ticketId', (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticketInfo = secureTicketSystem.getTicketInfo(ticketId);
        
        if (!ticketInfo) {
            return res.status(404).json({ 
                error: 'Ticket not found' 
            });
        }

        res.json({
            success: true,
            data: ticketInfo
        });
    } catch (error) {
        console.error('Error getting ticket info:', error);
        res.status(500).json({ 
            error: 'Failed to get ticket information',
            details: error.message 
        });
    }
});

// Verify ticket by ID (without QR code)
app.post('/api/secure-tickets/verify-by-id', async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({ 
                error: 'Ticket ID is required' 
            });
        }

        const verificationResult = await secureTicketSystem.verifyTicketById(ticketId);
        
        if (verificationResult.valid) {
            res.json({
                success: true,
                message: 'Ticket verified successfully',
                data: verificationResult.ticket
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Ticket verification failed',
                error: verificationResult.error
            });
        }
    } catch (error) {
        console.error('Error verifying ticket by ID:', error);
        res.status(500).json({ 
            error: 'Failed to verify ticket by ID',
            details: error.message 
        });
    }
});

// Manually add a ticket to the database
app.post('/api/secure-tickets/add-manual', async (req, res) => {
    try {
        const ticketInfo = req.body;
        
        if (!ticketInfo.ticketId) {
            return res.status(400).json({ 
                error: 'Ticket ID is required' 
            });
        }

        const newTicket = await secureTicketSystem.addTicketManually(ticketInfo);
        
        res.json({
            success: true,
            message: 'Ticket added successfully',
            data: newTicket
        });
    } catch (error) {
        console.error('Error adding manual ticket:', error);
        res.status(500).json({ 
            error: 'Failed to add manual ticket',
            details: error.message 
        });
    }
});

// Check if ticket exists
app.get('/api/secure-tickets/exists/:ticketId', (req, res) => {
    try {
        const { ticketId } = req.params;
        const exists = secureTicketSystem.ticketExists(ticketId);
        
        res.json({
            success: true,
            exists: exists,
            ticketId: ticketId
        });
    } catch (error) {
        console.error('Error checking ticket existence:', error);
        res.status(500).json({ 
            error: 'Failed to check ticket existence',
            details: error.message 
        });
    }
});

// Test endpoint to manually trigger seat updates
app.post('/api/test/emit-seat-update', (req, res) => {
    try {
        console.log('🧪 Manual seat update triggered via API');
        console.log('📊 Current connected clients:', io.engine.clientsCount);
        
        // Get room information
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        console.log('📊 Admin clients in room:', adminCount);
        
        // Emit seat update
        emitSeatUpdate();
        
        res.json({
            success: true,
            message: 'Seat update emitted to all connected clients',
            timestamp: new Date().toISOString(),
            connectedClients: io.engine.clientsCount,
            adminClients: adminCount
        });
    } catch (error) {
        console.error('Error emitting test seat update:', error);
        res.status(500).json({ 
            error: 'Failed to emit seat update',
            details: error.message 
        });
    }
});

// Test endpoint to check Socket.IO room status
app.get('/api/test/socket-status', (req, res) => {
    try {
        const adminsRoom = io.sockets.adapter.rooms.get('admins');
        const adminCount = adminsRoom ? adminsRoom.size : 0;
        
        const status = {
            connectedClients: io.engine.clientsCount,
            adminClients: adminCount,
            rooms: Array.from(io.sockets.adapter.rooms.keys()),
            timestamp: new Date().toISOString()
        };
        
        console.log('📊 Socket.IO Status:', status);
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting socket status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get socket status'
        });
    }
});

// Test endpoint to get Socket.IO connection info
app.get('/api/test/socket-info', (req, res) => {
    try {
        const connectedClients = io.engine.clientsCount;
        
        res.json({
            success: true,
            connectedClients: connectedClients,
            timestamp: new Date().toISOString(),
            message: `Currently ${connectedClients} client(s) connected to Socket.IO`
        });
    } catch (error) {
        console.error('Error getting socket info:', error);
        res.status(500).json({ 
            error: 'Failed to get socket info',
            details: error.message 
        });
    }
});

// Export for Vercel serverless functions
module.exports = app;

// Start server with error handling
async function startServer() {
    try {
        // Initialize database first
        await initializeApp();
        
        // Start the server
        server.listen(PORT, '0.0.0.0', (err) => {
            if (err) {
                console.error('❌ Failed to start server:', err);
                if (err.code === 'EADDRINUSE') {
                    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or use a different port.`);
                    console.error('💡 Try: netstat -ano | findstr :3000 (Windows) or lsof -i :3000 (Mac/Linux)');
                    console.error('💡 Or kill the process: taskkill /PID <pid> /F (Windows)');
                }
                process.exit(1);
            }
            
            console.log('🚀 Server started successfully!');
            console.log(`🌐 HTTP Server: http://localhost:${PORT}`);
            console.log(`🔌 Socket.IO Server: ws://localhost:${PORT}/socket.io/`);
            console.log('📱 Admin panel: http://localhost:3000/admin.html');
            console.log('🎓 Student portal: http://localhost:3000/index.html');
            console.log('🧪 Test page: http://localhost:3000/socket-test.html');
            console.log('');
            console.log('🔐 API Endpoints:');
            console.log('  POST /api/create-booking - Create new booking');
            console.log('  POST /api/confirm-payment - Confirm payment');
            console.log('  DELETE /api/delete-booking/:id - Delete booking');
            console.log('  GET  /api/seat-statuses - Get seat statuses');
            console.log('  POST /api/test/emit-seat-update - Test seat update');
            console.log('  GET  /api/test/socket-info - Socket.IO info');
            console.log('');
            console.log('🔌 Socket.IO Events:');
            console.log('  seatUpdate - Real-time seat status updates');
            console.log('  connected - Connection confirmation');
            console.log('  test - Test event');
            console.log('  requestSeatData - Request current seat data');
            console.log('  ping/pong - Connection health check');
            console.log('');
            console.log('🎯 Ready for real-time seat booking!');
            
            // Emit initial seat update
            emitSeatUpdate();
        });
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        process.exit(1);
    }
}

// Start the application
startServer();

// Handle server errors
server.on('error', (err) => {
    console.error('❌ Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('💡 Solutions:');
        console.error('  1. Stop the existing process using this port');
        console.error('  2. Change the port in config.js');
        console.error('  3. Kill the process: taskkill /PID <pid> /F (Windows)');
    }
});
// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

