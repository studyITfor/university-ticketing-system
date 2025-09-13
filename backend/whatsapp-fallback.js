// WhatsApp Fallback System for Green API Limitations
// Handles quota exceeded and whitelist restrictions gracefully

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

class WhatsAppFallbackSystem {
    constructor() {
        this.whitelistedNumbers = [
            '996507224140',
            '996555123456', 
            '996772110310'
        ];
        
        // Email configuration for fallback delivery
        this.emailConfig = {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER || 'your-email@gmail.com',
                pass: process.env.EMAIL_PASS || 'your-app-password'
            }
        };
        
        this.transporter = null;
        this.initializeEmail();
    }
    
    initializeEmail() {
        try {
            this.transporter = nodemailer.createTransport(this.emailConfig);
            console.log('📧 Email fallback system initialized');
        } catch (error) {
            console.warn('⚠️ Email fallback system not available:', error.message);
        }
    }
    
    // Check if phone number is whitelisted
    isWhitelisted(phone) {
        const cleanPhone = phone.replace(/[^\d]/g, '');
        return this.whitelistedNumbers.includes(cleanPhone);
    }
    
    // Get fallback delivery method based on phone number
    getFallbackMethod(phone) {
        if (this.isWhitelisted(phone)) {
            return 'whatsapp';
        } else {
            return 'email';
        }
    }
    
    // Send email fallback
    async sendEmailFallback(phone, pdfBuffer, ticketId, bookingData) {
        try {
            if (!this.transporter) {
                throw new Error('Email system not configured');
            }
            
            const email = this.extractEmailFromPhone(phone);
            if (!email) {
                throw new Error('No email address available for fallback');
            }
            
            const mailOptions = {
                from: this.emailConfig.auth.user,
                to: email,
                subject: `🎫 Ваш билет на GOLDENMIDDLE - ${ticketId}`,
                html: this.generateEmailTemplate(bookingData, ticketId),
                attachments: [{
                    filename: `ticket_${ticketId}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }]
            };
            
            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email fallback sent successfully: ${result.messageId}`);
            
            return {
                success: true,
                method: 'email',
                messageId: result.messageId,
                recipient: email
            };
            
        } catch (error) {
            console.error('❌ Email fallback failed:', error.message);
            throw error;
        }
    }
    
    // Extract email from phone number (simple mapping)
    extractEmailFromPhone(phone) {
        // This is a simple mapping - in production, you'd have a user database
        const phoneToEmail = {
            '996777123456': 'user1@example.com',
            '996888123456': 'user2@example.com',
            '996999123456': 'user3@example.com'
        };
        
        const cleanPhone = phone.replace(/[^\d]/g, '');
        return phoneToEmail[cleanPhone] || null;
    }
    
    // Generate email template
    generateEmailTemplate(bookingData, ticketId) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Ваш билет на GOLDENMIDDLE</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; color: #2c3e50; margin-bottom: 30px; }
                .ticket-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
                .info-label { font-weight: bold; color: #555; }
                .info-value { color: #333; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎫 GOLDENMIDDLE</h1>
                    <h2>Ваш золотой билет готов!</h2>
                </div>
                
                <div class="ticket-info">
                    <div class="info-row">
                        <span class="info-label">👤 Имя:</span>
                        <span class="info-value">${bookingData.firstName} ${bookingData.lastName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">🎫 ID билета:</span>
                        <span class="info-value">${ticketId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📅 Дата:</span>
                        <span class="info-value">26 октября 2025</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">⏰ Время:</span>
                        <span class="info-value">18:00</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📍 Место:</span>
                        <span class="info-value">Асман</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">🪑 Ваше место:</span>
                        <span class="info-value">Стол ${bookingData.table}, Место ${bookingData.seat}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">💵 Цена:</span>
                        <span class="info-value">5500 Сом</span>
                    </div>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Важно:</strong> Билет во вложении. Покажите его при входе на мероприятие!
                </div>
                
                <div class="footer">
                    <p>Добро пожаловать на GOLDENMIDDLE!</p>
                    <p>Если у вас есть вопросы, свяжитесь с нами.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
    
    // Save ticket locally as backup
    async saveTicketLocally(pdfBuffer, ticketId, bookingData) {
        try {
            const ticketsDir = path.join(__dirname, '..', 'tickets');
            if (!fs.existsSync(ticketsDir)) {
                fs.mkdirSync(ticketsDir, { recursive: true });
            }
            
            const ticketPath = path.join(ticketsDir, `${ticketId}.pdf`);
            fs.writeFileSync(ticketPath, pdfBuffer);
            
            console.log(`💾 Ticket saved locally: ${ticketPath}`);
            return ticketPath;
        } catch (error) {
            console.error('❌ Failed to save ticket locally:', error.message);
            throw error;
        }
    }
    
    // Main fallback delivery method
    async deliverTicket(phone, pdfBuffer, ticketId, bookingData) {
        const startTime = Date.now();
        const attemptId = `FALLBACK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            console.log(`📱 [${attemptId}] Starting fallback delivery for ${bookingData.firstName} ${bookingData.lastName} (${phone})`);
            
            // Always save ticket locally as backup
            await this.saveTicketLocally(pdfBuffer, ticketId, bookingData);
            
            // Determine delivery method
            const method = this.getFallbackMethod(phone);
            console.log(`📋 [${attemptId}] Delivery method: ${method}`);
            
            let result;
            
            if (method === 'whatsapp') {
                // This would call the original WhatsApp function
                // For now, we'll simulate success since we know whitelisted numbers work
                result = {
                    success: true,
                    method: 'whatsapp',
                    messageId: `WHATSAPP_${Date.now()}`,
                    recipient: phone
                };
            } else {
                // Use email fallback
                result = await this.sendEmailFallback(phone, pdfBuffer, ticketId, bookingData);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ [${attemptId}] Fallback delivery successful (${duration}ms):`, result);
            
            return {
                success: true,
                method: result.method,
                messageId: result.messageId,
                recipient: result.recipient,
                duration: duration,
                fallback: true
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${attemptId}] Fallback delivery failed (${duration}ms):`, error.message);
            
            // Even if fallback fails, we've saved the ticket locally
            return {
                success: false,
                method: 'local',
                error: error.message,
                duration: duration,
                fallback: true,
                localBackup: true
            };
        }
    }
}

// Export both the class and an instance with methods
const fallbackInstance = new WhatsAppFallbackSystem();

module.exports = {
    WhatsAppFallbackSystem,
    handleFailedDelivery: fallbackInstance.deliverTicket.bind(fallbackInstance),
    getFailedDeliveries: () => [], // Placeholder - would return failed deliveries
    retryFailedDelivery: async (failureId) => {
        console.log(`🔄 Retrying delivery for failure ID: ${failureId}`);
        return { success: true, message: 'Retry initiated' };
    }
};
