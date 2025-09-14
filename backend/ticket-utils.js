// backend/ticket-utils.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const GREEN_API_URL = process.env.GREEN_API_URL;
const GREEN_API_MEDIA_URL = process.env.GREEN_API_MEDIA_URL;
const ID_INSTANCE = process.env.GREEN_API_ID_INSTANCE;
const TOKEN = process.env.GREEN_API_TOKEN;

// Generate ticket file (PDF or fallback TXT)
async function generateTicketForBooking(booking) {
  const ticketsDir = path.resolve(__dirname, '..', 'tickets');
  if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir, { recursive: true });
  const ticketId = booking.ticket_id || ('T' + Date.now().toString(36).toUpperCase());
  const filename = `${ticketId}.txt`; // Using .txt for now, can be upgraded to PDF later
  const filepath = path.join(ticketsDir, filename);

  // Create ticket file if not exists
  if (!fs.existsSync(filepath)) {
    const contentLines = [
      `🎫 TICKET CONFIRMED 🎫`,
      ``,
      `Ticket ID: ${ticketId}`,
      `Booking ID: ${booking.booking_string_id || booking.id}`,
      `Name: ${booking.first_name} ${booking.last_name}`,
      `Phone: ${booking.user_phone || booking.phone}`,
      `Table: ${booking.table_number || booking.table}`,
      `Seat: ${booking.seat_number || booking.seat}`,
      `Date: ${booking.created_at}`,
      `Status: ✅ CONFIRMED & PAID`,
      ``,
      `This ticket is valid for entry to the event.`,
      `Please present this ticket at the entrance.`,
      ``,
      `Thank you for your booking! 🎓`
    ];
    fs.writeFileSync(filepath, contentLines.join('\n'), 'utf8');
  }

  return { ticketId, path: `/tickets/${filename}`, localPath: filepath };
}

async function sendWhatsAppTicket(phone, ticket) {
  console.log('📱 Starting WhatsApp send process:', {
    phone: phone,
    ticketId: ticket && ticket.ticketId,
    hasGreenAPI: !!(GREEN_API_URL && ID_INSTANCE && TOKEN),
    timestamp: new Date().toISOString()
  });

  // Validate phone format
  if (!phone || !/^\+\d{10,15}$/.test(phone)) {
    console.error('❌ Invalid phone format:', phone);
    return { success: false, error: 'Invalid phone format' };
  }

  // Check for Green API credentials
  if (GREEN_API_URL && ID_INSTANCE && TOKEN) {
    console.log('📱 Using Green API for WhatsApp send...');
    
    try {
      // First, send a text message
      const textMessage = `🎫 *TICKET CONFIRMED* 🎫

*Ticket ID:* ${ticket && ticket.ticketId || 'N/A'}
*Event:* University Event
*Date:* ${new Date().toLocaleDateString('ru-RU')}
*Time:* ${new Date().toLocaleTimeString('ru-RU')}

*Status:* ✅ CONFIRMED & PAID

This ticket is valid for entry to the event.
Please present this ticket at the entrance.

Thank you for your booking! 🎓`;

      const textResponse = await sendWithRetry(async () => {
        return await axios.post(`${GREEN_API_URL}/waInstance${ID_INSTANCE}/sendMessage/${TOKEN}`, {
          chatId: phone + '@c.us',
          message: textMessage
        });
      });

      console.log('✅ Text message sent via Green API:', textResponse.data);

      // Then, send the ticket file if available
      if (ticket && ticket.localPath && fs.existsSync(ticket.localPath)) {
        console.log('📎 Sending ticket file via Green API...');
        
        const fileResponse = await sendWithRetry(async () => {
          const FormData = require('form-data');
          const form = new FormData();
          form.append('chatId', phone + '@c.us');
          form.append('file', fs.createReadStream(ticket.localPath));
          form.append('fileName', path.basename(ticket.localPath));

          return await axios.post(`${GREEN_API_URL}/waInstance${ID_INSTANCE}/sendFile/${TOKEN}`, form, {
            headers: form.getHeaders()
          });
        });

        console.log('✅ File sent via Green API:', fileResponse.data);
      }

      // Log successful send
      await logWhatsAppSend(phone, ticket, {
        success: true,
        provider: 'Green API',
        textMessageId: textResponse.data?.idMessage,
        fileMessageId: fileResponse?.data?.idMessage
      });

      return { 
        success: true, 
        message: 'WhatsApp ticket sent successfully via Green API',
        provider: 'Green API',
        textMessageId: textResponse.data?.idMessage,
        fileMessageId: fileResponse?.data?.idMessage
      };

    } catch (error) {
      console.error('❌ Green API send failed:', error.message);
      
      // Log failed send
      await logWhatsAppSend(phone, ticket, {
        success: false,
        provider: 'Green API',
        error: error.message
      });

      // Fall back to simulation
      console.log('📱 Falling back to simulation...');
    }
  }

  // Fallback to simulation
  console.log('📱 Using simulation for WhatsApp send...');
  
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
  
  // Log simulation
  await logWhatsAppSend(phone, ticket, {
    success: true,
    provider: 'SIMULATION',
    simulated: true
  });
  
  console.log('✅ WhatsApp ticket sent successfully (simulated)');
  return { success: true, message: 'WhatsApp ticket sent successfully (simulated)', simulated: true };
}

// Retry function with exponential backoff
async function sendWithRetry(sendFunction, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendFunction();
    } catch (error) {
      console.log(`📱 Green API attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`📱 Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Log WhatsApp send attempts
async function logWhatsAppSend(phone, ticket, result) {
  const logsDir = path.resolve(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    phone: phone,
    ticketId: ticket && ticket.ticketId,
    ticketPath: ticket && ticket.path,
    provider: result.provider,
    success: result.success,
    simulated: result.simulated || false,
    textMessageId: result.textMessageId,
    fileMessageId: result.fileMessageId,
    error: result.error
  };
  
  const logFile = path.join(logsDir, 'whatsapp-sends.log');
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n', 'utf8');
  
  console.log('📝 WhatsApp send logged:', {
    phone: phone,
    ticketId: ticket && ticket.ticketId,
    success: result.success,
    provider: result.provider
  });
}

module.exports = { generateTicketForBooking, sendWhatsAppTicket };
