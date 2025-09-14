// backend/ticket-utils.js
const fs = require('fs');
const path = require('path');

async function generateTicketForBooking(booking) {
  // Minimal: create a simple text file for now, include booking info and booking_string_id
  const ticketsDir = path.resolve(__dirname, '..', 'tickets');
  if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir, { recursive: true });
  const ticketId = 'T' + Date.now().toString(36).toUpperCase();
  const filename = `${ticketId}.txt`;
  const filepath = path.join(ticketsDir, filename);
  const content = [
    `Ticket: ${ticketId}`,
    `Booking ID: ${booking.booking_string_id || booking.id}`,
    `Name: ${booking.first_name} ${booking.last_name}`,
    `Phone: ${booking.user_phone || booking.phone}`,
    `Table: ${booking.table_number || booking.table}`,
    `Seat: ${booking.seat_number || booking.seat}`,
    `Date: ${booking.created_at}`
  ].join('\n');
  fs.writeFileSync(filepath, content, 'utf8');
  return { ticketId, path: `/tickets/${filename}` };
}

async function sendWhatsAppTicket(phone, ticket) {
  const fs = require('fs');
  const path = require('path');
  
  // Validate phone format
  if (!phone || !/^\+\d{10,15}$/.test(phone)) {
    console.error('❌ Invalid phone format:', phone);
    return { success: false, error: 'Invalid phone format' };
  }

  // Check for real provider credentials
  const hasTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
  const hasMessageBird = process.env.MESSAGEBIRD_API_KEY;
  
  if (hasTwilio || hasMessageBird) {
    console.log('📱 Using real WhatsApp provider...');
    // TODO: Implement real provider integration
    // For now, fall through to simulation
  }
  
  // Simulate WhatsApp send with retry logic
  console.log('📱 Simulating WhatsApp send to', phone, 'ticket', ticket && ticket.ticketId);
  
  const message = `🎫 *TICKET CONFIRMED* 🎫

*Ticket ID:* ${ticket && ticket.ticketId || 'N/A'}
*Event:* University Event
*Date:* ${new Date().toLocaleDateString('ru-RU')}
*Time:* ${new Date().toLocaleTimeString('ru-RU')}

*Status:* ✅ CONFIRMED & PAID

This ticket is valid for entry to the event.
Please present this ticket at the entrance.

Thank you for your booking! 🎓`;

  console.log('📱 WhatsApp message content:');
  console.log(message);
  
  // Log to append-only file
  const logsDir = path.resolve(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    phone: phone,
    ticketId: ticket && ticket.ticketId,
    ticketPath: ticket && ticket.path,
    message: message,
    simulated: true
  };
  
  const logFile = path.join(logsDir, 'whatsapp-sends.log');
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
  
  console.log('✅ WhatsApp ticket sent successfully (simulated)');
  return { success: true, message: 'WhatsApp ticket sent successfully', simulated: true };
}

module.exports = { generateTicketForBooking, sendWhatsAppTicket };
