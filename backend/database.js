// backend/database.js
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set - using mock database for local testing');
  
  // In-memory storage for mock database
  const mockData = {
    users: new Map(),
    bookings: new Map(),
    bookingsByStringId: new Map(), // Store bookings by string ID
    nextUserId: 1,
    nextBookingId: 1
  };
  
  // Return mock functions for local testing
  module.exports = { 
    pool: null, 
    query: async (text, params) => {
      // Mock database behavior for local testing
      if (text.includes('INSERT INTO users')) {
        const user = { id: mockData.nextUserId++, phone: params[0], role: params[1], created_at: new Date().toISOString() };
        mockData.users.set(params[0], user);
        return { rows: [user] };
      }
      if (text.includes('INSERT INTO bookings')) {
        const booking = { 
          id: mockData.nextBookingId++,
          booking_string_id: params[0],
          user_phone: params[1],
          event_id: params[2],
          seat: params[3],
          table_number: params[4],
          seat_number: params[5],
          first_name: params[6],
          last_name: params[7],
          status: params[8],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        // Store by numeric ID and string ID
        mockData.bookings.set(booking.id, booking);
        mockData.bookingsByStringId.set(booking.booking_string_id, booking);
        return { rows: [booking] };
      }
      if (text.includes('SELECT b.*, u.phone FROM bookings b JOIN users u ON b.user_phone = u.phone WHERE b.booking_string_id')) {
        // Find booking by string ID
        console.log('🔍 Mock DB: Looking for booking with string ID:', params[0]);
        console.log('🔍 Mock DB: Available bookings:', Array.from(mockData.bookingsByStringId.keys()));
        const booking = mockData.bookingsByStringId.get(params[0]);
        if (booking) {
          const user = mockData.users.get(booking.user_phone);
          console.log('✅ Mock DB: Found booking:', booking);
          return { rows: [{ ...booking, phone: user?.phone }] };
        }
        console.log('❌ Mock DB: Booking not found');
        return { rows: [] };
      }
      if (text.includes('UPDATE bookings SET status = $1, payment_date = $2, payment_confirmed_by = $3, ticket_id = $4, updated_at = now() WHERE booking_string_id = $5')) {
        const booking = mockData.bookingsByStringId.get(params[4]);
        if (booking) {
          booking.status = params[0];
          booking.payment_date = params[1];
          booking.payment_confirmed_by = params[2];
          booking.ticket_id = params[3];
          booking.updated_at = new Date().toISOString();
        }
        return { rows: booking ? [booking] : [] };
      }
      if (text.includes('SELECT * FROM bookings WHERE seat')) {
        return { rows: [] }; // No existing bookings for mock
      }
      if (text.includes('SELECT * FROM bookings WHERE booking_string_id=$1 OR id::text = $1 LIMIT 1')) {
        // Handle confirm-payment query
        console.log('🔍 Mock DB: Looking for booking with string ID or numeric ID:', params[0]);
        console.log('🔍 Mock DB: Available bookings:', Array.from(mockData.bookingsByStringId.keys()));
        const booking = mockData.bookingsByStringId.get(params[0]) || mockData.bookings.get(parseInt(params[0]));
        if (booking) {
          console.log('✅ Mock DB: Found booking for confirm-payment:', booking);
          return { rows: [booking] };
        }
        console.log('❌ Mock DB: Booking not found for confirm-payment');
        return { rows: [] };
      }
      if (text.includes('SELECT id, booking_string_id, first_name, last_name, status FROM bookings ORDER BY created_at DESC LIMIT 10')) {
        // Handle debug query
        const bookings = Array.from(mockData.bookingsByStringId.values());
        console.log('🔍 Mock DB: Returning all bookings for debug:', bookings);
        return { rows: bookings };
      }
      if (text.includes('INSERT INTO payments')) {
        // Handle payment insertion
        const payment = {
          id: mockData.nextBookingId++,
          transaction_id: params[0],
          booking_id: params[1],
          user_phone: params[2],
          amount: params[3],
          status: params[4],
          provider: params[5],
          raw_payload: params[6],
          created_at: new Date().toISOString()
        };
        return { rows: [payment] };
      }
      if (text.includes('UPDATE bookings SET status=$1, updated_at=now() WHERE id=$2')) {
        // Handle booking status update
        const booking = mockData.bookings.get(params[1]);
        if (booking) {
          booking.status = params[0];
          booking.updated_at = new Date().toISOString();
          console.log('✅ Mock DB: Updated booking status:', booking);
          return { rows: [booking] };
        }
        return { rows: [] };
      }
      if (text.includes('UPDATE bookings SET whatsapp_sent = true, whatsapp_message_id = $1, ticket_id = $2, updated_at = now() WHERE id=$3')) {
        // Handle WhatsApp update
        const booking = mockData.bookings.get(params[2]);
        if (booking) {
          booking.whatsapp_sent = true;
          booking.whatsapp_message_id = params[0];
          booking.ticket_id = params[1];
          booking.updated_at = new Date().toISOString();
          console.log('✅ Mock DB: Updated booking WhatsApp info:', booking);
          return { rows: [booking] };
        }
        return { rows: [] };
      }
      return { rows: [] };
    }, 
    getSeatStatuses: async () => [], 
    checkDatabaseHealth: async () => false 
  };
  return;
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function getSeatStatuses() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        user_phone,
        seat,
        status,
        created_at,
        updated_at
      FROM bookings 
      ORDER BY created_at DESC
    `);
    
    // Transform the data to match the expected format
    return result.rows.map(booking => {
      // Parse seat format like "3-5" to get table_number and seat_number
      const [table_number, seat_number] = booking.seat.split('-').map(Number);
      
      return {
        id: booking.id,
        user_phone: booking.user_phone,
        table_number: table_number,
        seat_number: seat_number,
        status: booking.status,
        created_at: booking.created_at,
        updated_at: booking.updated_at
      };
    });
  } catch (error) {
    console.error('Error fetching seat statuses:', error);
    return [];
  }
}

async function checkDatabaseHealth() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

module.exports = { pool, query, getSeatStatuses, checkDatabaseHealth };