// backend/whatsapp-service.js
const axios = require('axios');
const { query } = require('./database');

class WhatsAppService {
  constructor() {
    this.provider = this.detectProvider();
    this.rateLimit = {
      maxRequests: parseInt(process.env.RATE_LIMIT) || 20,
      windowMs: 60 * 1000, // 1 minute
      requests: [],
    };
  }

  detectProvider() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return 'twilio';
    } else if (process.env.GREEN_API_KEY) {
      return 'green_api';
    }
    return 'none';
  }

  async checkRateLimit() {
    const now = Date.now();
    // Remove requests older than the window
    this.rateLimit.requests = this.rateLimit.requests.filter(
      time => now - time < this.rateLimit.windowMs
    );
    
    if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    this.rateLimit.requests.push(now);
  }

  async logMessage(messageId, phone, direction, body, status, errorCode = null) {
    try {
      await query(`
        INSERT INTO messages_log (message_id, phone, direction, body, status, error_code, provider)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [messageId, phone, direction, body, status, errorCode, this.provider]);
    } catch (error) {
      console.error('Failed to log message:', error);
    }
  }

  async sendMessage(phone, message) {
    await this.checkRateLimit();
    
    if (this.provider === 'twilio') {
      return await this.sendViaTwilio(phone, message);
    } else if (this.provider === 'green_api') {
      return await this.sendViaGreenAPI(phone, message);
    } else {
      // Return a structured error instead of throwing
      console.warn('WhatsApp provider not configured - returning mock success for development');
      return {
        success: false,
        error: 'WhatsApp service not configured',
        code: 'PROVIDER_NOT_CONFIGURED',
        isDevelopmentMode: process.env.NODE_ENV !== 'production'
      };
    }
  }

  async sendViaTwilio(phone, message) {
    try {
      const from = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`;
      const to = `whatsapp:${phone}`;
      
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        new URLSearchParams({
          From: from,
          To: to,
          Body: message
        }),
        {
          auth: {
            username: process.env.TWILIO_ACCOUNT_SID,
            password: process.env.TWILIO_AUTH_TOKEN
          }
        }
      );
      
      const messageId = response.data.sid;
      await this.logMessage(messageId, phone, 'outbound', message, 'sent');
      
      return {
        success: true,
        messageId,
        status: 'sent'
      };
      
    } catch (error) {
      console.error('Twilio send error:', error.response?.data || error.message);
      await this.logMessage(null, phone, 'outbound', message, 'failed', error.response?.data?.code);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async sendViaGreenAPI(phone, message) {
    try {
      const response = await axios.post(
        `https://api.green-api.com/waInstance${process.env.GREEN_API_INSTANCE_ID}/sendMessage/${process.env.GREEN_API_TOKEN}`,
        {
          chatId: `${phone}@c.us`,
          message: message
        }
      );
      
      const messageId = response.data.idMessage;
      await this.logMessage(messageId, phone, 'outbound', message, 'sent');
      
      return {
        success: true,
        messageId,
        status: 'sent'
      };
      
    } catch (error) {
      console.error('Green API send error:', error.response?.data || error.message);
      
      let errorCode = 'unknown';
      if (error.response?.data?.message) {
        if (error.response.data.message.includes('quotaExceeded')) {
          errorCode = 'quota_exceeded';
        } else if (error.response.data.message.includes('invalid phone')) {
          errorCode = 'invalid_phone';
        }
      }
      
      await this.logMessage(null, phone, 'outbound', message, 'failed', errorCode);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async sendConfirmationCode(phone, code, name) {
    const message = `Привет, ${name}! 

Ваш код подтверждения для GOLDENMIDDLE: ${code}

Или перейдите по ссылке: ${process.env.BASE_URL || 'https://your-domain.com'}/confirm?phone=${encodeURIComponent(phone)}&code=${code}

Отписаться можно, ответив STOP.`;

    return await this.sendMessage(phone, message);
  }

  async sendTicket(phone, ticketUrl, bookingDetails) {
    const message = `🎫 Ваш билет на мероприятие GOLDENMIDDLE готов!

Место: ${bookingDetails.seat}
Дата: 26 октября 2025, 18:00
Место: Асман

Скачать билет: ${ticketUrl}

Отписаться можно, ответив STOP.`;

    return await this.sendMessage(phone, message);
  }

  async sendUnsubscribeConfirmation(phone) {
    const message = `Вы успешно отписались от уведомлений GOLDENMIDDLE.

Если передумаете, можете снова подписаться при следующем бронировании.`;

    return await this.sendMessage(phone, message);
  }

  async handleIncomingMessage(phone, body) {
    const normalizedBody = body.trim().toUpperCase();
    
    if (normalizedBody === 'STOP' || normalizedBody === 'СТОП' || normalizedBody === 'UNSUBSCRIBE') {
      // Mark as unsubscribed
      await query(`
        UPDATE opt_ins 
        SET unsubscribed = true, unsubscribed_at = now() 
        WHERE phone = $1
      `, [phone]);
      
      // Send confirmation
      await this.sendUnsubscribeConfirmation(phone);
      
      await this.logMessage(null, phone, 'inbound', body, 'processed');
      
      return {
        success: true,
        action: 'unsubscribed'
      };
    }
    
    await this.logMessage(null, phone, 'inbound', body, 'received');
    
    return {
      success: true,
      action: 'logged'
    };
  }
}

module.exports = WhatsAppService;
