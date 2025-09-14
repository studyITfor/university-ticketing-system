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
  // If real provider configured, call it. Otherwise simulate and log.
  console.log('Simulating WhatsApp send to', phone, 'ticket', ticket && ticket.ticketId);
  // In production, integrate Twilio/MessageBird etc.
  return true;
}

module.exports = { generateTicketForBooking, sendWhatsAppTicket };
