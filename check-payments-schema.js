// Check payments schema and sample data
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFFnDcJ@switchback.proxy.rlwy.net:23858/railway'
});

async function checkPaymentsSchema() {
  try {
    console.log('🔍 Checking payments table schema...');
    
    // Get column information
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'payments' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Payments table columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
    });
    
    // Get sample payments data
    console.log('\n📊 Sample payments data (last 5):');
    const paymentsResult = await pool.query(`
      SELECT id, transaction_id, booking_id, user_phone, amount, status, created_at
      FROM payments 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    paymentsResult.rows.forEach(payment => {
      console.log(`  ID: ${payment.id}, Transaction: ${payment.transaction_id}, Booking: ${payment.booking_id}, Phone: ${payment.user_phone}, Amount: ${payment.amount}, Status: ${payment.status}`);
    });
    
    // Check recent bookings for testing
    console.log('\n🎫 Recent bookings for testing:');
    const bookingsResult = await pool.query(`
      SELECT id, booking_string_id, first_name, last_name, status, created_at
      FROM bookings 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    bookingsResult.rows.forEach(booking => {
      console.log(`  ID: ${booking.id}, String ID: ${booking.booking_string_id}, Name: ${booking.first_name} ${booking.last_name}, Status: ${booking.status}`);
    });
    
    await pool.end();
    console.log('\n✅ Database check completed');
    
  } catch (error) {
    console.error('❌ Database check error:', error.message);
    await pool.end();
  }
}

checkPaymentsSchema();
