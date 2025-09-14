// backend/check_booking.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFFnDcJ@switchback.proxy.rlwy.net:23858/railway'
});

const db = {
  query: (text, params) => pool.query(text, params)
};

(async () => {
  try {
    const bookingId = process.argv[2] || 'BKMFJX305E';
    console.log('🔍 Checking booking:', bookingId);

    // Check booking details
    const findSql = `
      SELECT booking_string_id, id, first_name, last_name, user_phone, status, 
             created_at, updated_at
      FROM bookings
      WHERE booking_string_id = $1 OR id::text = $1
      LIMIT 1
    `;
    const findRes = await db.query(findSql, [bookingId]);
    console.log('📋 Booking details:', findRes.rows[0] || 'Not found');

    // Check recent payments
    const paymentsSql = `SELECT id, booking_id, amount, status, created_at FROM payments ORDER BY created_at DESC LIMIT 5`;
    const paymentsRes = await db.query(paymentsSql);
    console.log('💳 Recent payments:', paymentsRes.rows);

    // Check table schema
    const schemaSql = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      ORDER BY ordinal_position
    `;
    const schemaRes = await db.query(schemaSql);
    console.log('🗃️ Bookings table schema:', schemaRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR in check_booking.js:', err);
    await pool.end();
    process.exit(1);
  }
})();
