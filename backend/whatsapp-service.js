// backend/whatsapp-service.js
const axios = require('axios');
const { query } = require('./database');

class WhatsAppService {
  constructor() {
    // Hardcoded Green API credentials for development
    this.apiUrl = 'https://7105.api.greenapi.com';
    this.mediaUrl = 'https://7105.media.greenapi.com';
    this.idInstance = '7105317460';
    this.apiToken = '76de4f547a564df4a3092b41aeacfd7ad0e848b3506d42a1b9';
    this.instancePhone = '+996555245629';
    
    this.provider = 'green_api'; // Always use Green API
    this.rateLimit = {
      maxRequests: parseInt(process.env.RATE_LIMIT) || 20,
      windowMs: 60 * 1000, // 1 minute
      requests: [],
    };
    
    console.log('✅ WhatsApp Service initialized with Green API');
    console.log(`📱 Instance: ${this.idInstance}`);
    console.log(`📞 Phone: ${this.maskPhone(this.instancePhone)}`);
  }

  /**
   * Mask phone number for logging (show only last 4 digits)
   * @param {string} phone - Phone number to mask
   * @returns {string} - Masked phone number
   */
  maskPhone(phone) {
    if (!phone) return 'N/A';
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }

  /**
   * Validate E.164 phone format
   * @param {string} phone - Phone number to validate
   * @returns {Object} - Validation result
   */
  validatePhone(phone) {
    if (!phone) {
      return { valid: false, error: 'Phone number is required' };
    }

    // E.164 format: +[country code][number] (max 15 digits total)
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    
    if (!e164Regex.test(phone)) {
      return { 
        valid: false, 
        error: 'Phone number must be in E.164 format (+[country code][number])' 
      };
    }

    if (phone.length > 15) {
      return { 
        valid: false, 
        error: 'Phone number too long (max 15 digits for E.164)' 
      };
    }

    return { valid: true };
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
    
    // Validate phone number
    const phoneValidation = this.validatePhone(phone);
    if (!phoneValidation.valid) {
      return {
        success: false,
        error: phoneValidation.error,
        code: 'INVALID_PHONE_FORMAT'
      };
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: 'Message cannot be empty',
        code: 'EMPTY_MESSAGE'
      };
    }

    try {
      console.log(`📤 Sending message to ${this.maskPhone(phone)} via Green API`);
      console.log(`📝 Message preview: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

      const response = await axios.post(
        `${this.apiUrl}/instances/${this.idInstance}/sendMessage/${this.apiToken}`,
        {
          phone: phone,
          message: message.trim()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'University-Ticketing-System/1.0'
          },
          timeout: 10000 // 10 second timeout
        }
      );
      
      const messageId = response.data.idMessage;
      await this.logMessage(messageId, phone, 'outbound', message, 'sent');
      
      console.log(`✅ Message sent successfully:`, {
        messageId: messageId,
        phone: this.maskPhone(phone),
        status: response.data.success
      });
      
      return {
        success: true,
        messageId,
        status: 'sent',
        provider: 'green_api'
      };
      
    } catch (error) {
      console.error('❌ Green API send error:', error.response?.data || error.message);
      
      let errorCode = 'unknown';
      let errorMessage = 'Failed to send message';
      
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
          
          if (error.response.data.message.includes('quotaExceeded')) {
            errorCode = 'quota_exceeded';
          } else if (error.response.data.message.includes('invalid phone')) {
            errorCode = 'invalid_phone';
          } else if (error.response.data.message.includes('unauthorized')) {
            errorCode = 'unauthorized';
          }
        }
        
        if (error.response.status === 401 || error.response.status === 403) {
          errorCode = 'auth_error';
          errorMessage = 'Authentication failed - check API credentials';
        } else if (error.response.status === 429) {
          errorCode = 'rate_limit';
          errorMessage = 'Rate limit exceeded - please try again later';
        }
      } else if (error.code === 'ECONNABORTED') {
        errorCode = 'timeout';
        errorMessage = 'Request timeout - please try again';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorCode = 'network_error';
        errorMessage = 'Network error - please check connection';
      }
      
      // For development/testing, provide mock success when Green API fails
      if (process.env.NODE_ENV !== 'production' && (errorCode === 'auth_error' || errorCode === 'unknown')) {
        console.warn('🔧 Development mode: Green API failed, returning mock success');
        const mockMessageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await this.logMessage(mockMessageId, phone, 'outbound', message, 'sent_mock');
        
        return {
          success: true,
          messageId: mockMessageId,
          status: 'sent_mock',
          provider: 'green_api',
          developmentMode: true,
          originalError: errorMessage
        };
      }
      
      await this.logMessage(null, phone, 'outbound', message, 'failed', errorCode);
      
      return {
        success: false,
        error: errorMessage,
        code: errorCode,
        provider: 'green_api'
      };
    }
  }

  async sendConfirmationCode(phone, code, name) {
    const message = `🎫 *GOLDENMIDDLE EVENT* 🎫

Привет, ${name}! 👋

Ваш код подтверждения: *${code}*

Используйте этот код для подтверждения бронирования.

С уважением,
Команда GOLDENMIDDLE`;

    return await this.sendMessage(phone, message);
  }

  async sendTicket(phone, ticketUrl, bookingDetails) {
    const message = `🎫 *Ваш билет на мероприятие GOLDENMIDDLE готов!* 🎫

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
      try {
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
      } catch (error) {
        console.error('Error handling unsubscribe:', error);
        return {
          success: false,
          error: 'Failed to process unsubscribe request'
        };
      }
    }
    
    await this.logMessage(null, phone, 'inbound', body, 'received');
    
    return {
      success: true,
      action: 'logged'
    };
  }

  /**
   * Check if service is properly configured
   * @returns {boolean} - Configuration status
   */
  isServiceConfigured() {
    return !!(this.apiUrl && this.idInstance && this.apiToken);
  }

  /**
   * Get service status information
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      configured: this.isServiceConfigured(),
      provider: this.provider,
      apiUrl: this.apiUrl,
      idInstance: this.idInstance,
      instancePhone: this.maskPhone(this.instancePhone),
      hasToken: !!this.apiToken
    };
  }
}

module.exports = WhatsAppService;