// backend/fix_problematic_bookings.js
const { Pool } = require('pg');
const { generateTicketForBooking } = require('./ticket-utils');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFFnDcJ@switchback.proxy.rlwy.net:23858/railway'
});

const db = {
  query: (text, params) => pool.query(text, params)
};

(async () => {
  try {
    console.log('🔧 FIXING PROBLEMATIC BOOKINGS');
    console.log('='.repeat(50));

    // Find all paid bookings with missing WhatsApp data
    const problematicSql = `
      SELECT id, booking_string_id, status, ticket_id, whatsapp_sent, whatsapp_message_id,
             first_name, last_name, user_phone, created_at
      FROM bookings 
      WHERE status = 'paid' AND (whatsapp_sent = false OR whatsapp_sent IS NULL OR ticket_id IS NULL)
      ORDER BY created_at DESC
    `;
    const problematicRes = await db.query(problematicSql);
    
    console.log(`Found ${problematicRes.rows.length} problematic bookings to fix`);

    for (const booking of problematicRes.rows) {
      console.log(`\n🔧 Fixing booking ${booking.booking_string_id} (ID: ${booking.id})`);
      
      try {
        // Generate ticket if missing
        let ticket = null;
        if (!booking.ticket_id) {
          console.log('  🎫 Generating missing ticket...');
          ticket = await generateTicketForBooking(booking);
          console.log('  ✅ Ticket generated:', ticket.ticketId);
        } else {
          console.log('  ℹ️ Ticket already exists:', booking.ticket_id);
          ticket = { ticketId: booking.ticket_id };
        }

        // Update booking with proper values
        const updateSql = `
          UPDATE bookings 
          SET ticket_id = $1, 
              whatsapp_sent = true, 
              whatsapp_message_id = $2,
              updated_at = now()
          WHERE id = $3
          RETURNING *
        `;
        
        const messageId = `FIXED-${Date.now()}-${booking.id}`;
        const updateRes = await db.query(updateSql, [ticket.ticketId, messageId, booking.id]);
        
        console.log('  ✅ Booking updated successfully:', {
          ticket_id: ticket.ticketId,
          whatsapp_sent: true,
          whatsapp_message_id: messageId
        });

      } catch (error) {
        console.error(`  ❌ Failed to fix booking ${booking.booking_string_id}:`, error.message);
      }
    }

    // Verify fixes
    console.log('\n📊 VERIFICATION:');
    const verifySql = `
      SELECT id, booking_string_id, status, ticket_id, whatsapp_sent, whatsapp_message_id
      FROM bookings 
      WHERE status = 'paid' AND (whatsapp_sent = false OR whatsapp_sent IS NULL OR ticket_id IS NULL)
      ORDER BY created_at DESC
    `;
    const verifyRes = await db.query(verifySql);
    
    if (verifyRes.rows.length === 0) {
      console.log('✅ All paid bookings now have proper WhatsApp data!');
    } else {
      console.log(`❌ Still ${verifyRes.rows.length} problematic bookings remaining:`);
      console.table(verifyRes.rows);
    }

    await pool.end();
    console.log('\n✅ Fix process complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR in fix_problematic_bookings.js:', err);
    await pool.end();
    process.exit(1);
  }
})();
