// backend/check_booking.js
const { Pool } = require('pg');

// Use public Railway database URL
const pool = new Pool({
  connectionString: 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFFnDcJ@switchback.proxy.rlwy.net:23858/railway'
});

const db = {
  query: (text, params) => pool.query(text, params)
};
(async () => {
  try {
    const bookingId = process.argv[2] || 'BKMFJU7O2P';
    console.log('Lookup bookingId:', bookingId);

    const findSql = `
      SELECT booking_string_id, id, first_name, last_name, user_phone, status, created_at
      FROM bookings
      WHERE booking_string_id = $1 OR id::text = $1
      LIMIT 1
    `;
    const findRes = await db.query(findSql, [bookingId]);
    console.log('Booking lookup result:', findRes.rows);

    const cols = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='bookings' ORDER BY ordinal_position"
    );
    console.log('Bookings table columns:', cols.rows.map(r => r.column_name).join(', '));

    const recent = await db.query("SELECT booking_string_id, id, user_phone, status, created_at FROM bookings ORDER BY created_at DESC LIMIT 20");
    console.log('Last 20 bookings:', recent.rows);

    process.exit(0);
  } catch (err) {
    console.error('ERROR in check_booking.js:', err);
    process.exit(1);
  }
})();
