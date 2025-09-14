// backend/analyze_db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFFnDcJ@switchback.proxy.rlwy.net:23858/railway'
});

const db = {
  query: (text, params) => pool.query(text, params)
};

(async () => {
  try {
    console.log('🔍 ANALYZING DATABASE STATE');
    console.log('='.repeat(50));

    // 1. Check bookings table schema
    console.log('\n📋 BOOKINGS TABLE SCHEMA:');
    const schemaSql = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      ORDER BY ordinal_position
    `;
    const schemaRes = await db.query(schemaSql);
    schemaRes.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });

    // 2. Check recent bookings with status, ticket_id, whatsapp_sent
    console.log('\n📊 RECENT BOOKINGS (last 20):');
    const bookingsSql = `
      SELECT id, booking_string_id, status, ticket_id, whatsapp_sent, whatsapp_message_id, 
             first_name, last_name, user_phone, created_at, updated_at
      FROM bookings 
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    const bookingsRes = await db.query(bookingsSql);
    console.table(bookingsRes.rows);

    // 3. Find problematic entries
    console.log('\n❌ PROBLEMATIC ENTRIES:');
    const problematicSql = `
      SELECT id, booking_string_id, status, ticket_id, whatsapp_sent, whatsapp_message_id
      FROM bookings 
      WHERE status = 'paid' AND (whatsapp_sent = false OR whatsapp_sent IS NULL OR ticket_id IS NULL)
      ORDER BY created_at DESC
    `;
    const problematicRes = await db.query(problematicSql);
    if (problematicRes.rows.length > 0) {
      console.log('Found paid bookings with missing WhatsApp data:');
      console.table(problematicRes.rows);
    } else {
      console.log('✅ No problematic entries found');
    }

    // 4. Check payments table
    console.log('\n💳 PAYMENTS TABLE ANALYSIS:');
    const paymentsSchemaSql = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'payments' 
      ORDER BY ordinal_position
    `;
    const paymentsSchemaRes = await db.query(paymentsSchemaSql);
    paymentsSchemaRes.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // 5. Check for NULL booking_id in payments
    console.log('\n🔍 PAYMENTS WITH NULL booking_id:');
    const nullBookingIdSql = `SELECT * FROM payments WHERE booking_id IS NULL`;
    const nullBookingIdRes = await db.query(nullBookingIdSql);
    if (nullBookingIdRes.rows.length > 0) {
      console.log('Found payments with NULL booking_id:');
      console.table(nullBookingIdRes.rows);
    } else {
      console.log('✅ No payments with NULL booking_id found');
    }

    // 6. Recent payments with booking details
    console.log('\n📈 RECENT PAYMENTS (last 10):');
    const recentPaymentsSql = `
      SELECT p.id, p.booking_id, p.amount, p.status, p.created_at,
             b.booking_string_id, b.status as booking_status, b.whatsapp_sent, b.ticket_id
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.booking_string_id OR p.booking_id::text = b.booking_string_id
      ORDER BY p.created_at DESC 
      LIMIT 10
    `;
    const recentPaymentsRes = await db.query(recentPaymentsSql);
    console.table(recentPaymentsRes.rows);

    await pool.end();
    console.log('\n✅ Database analysis complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR in analyze_db.js:', err);
    await pool.end();
    process.exit(1);
  }
})();
