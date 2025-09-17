// backend/greenapi-service.js
const fetch = require('undici').fetch;

class GreenAPIService {
    constructor() {
        this.apiUrl = process.env.GREEN_API_URL;
        this.mediaUrl = process.env.GREEN_MEDIA_URL;
        this.instanceId = process.env.GREEN_ID_INSTANCE;
        this.apiToken = process.env.GREEN_API_TOKEN;
        this.instancePhone = process.env.GREEN_INSTANCE_PHONE;
        
        this.isConfigured = !!(this.apiUrl && this.instanceId && this.apiToken);
        
        if (this.isConfigured) {
            console.log('✅ Green API service configured');
            console.log(`📱 Instance: ${this.instanceId}`);
            console.log(`📞 Phone: ${this.maskPhone(this.instancePhone)}`);
        } else {
            console.warn('⚠️ Green API service not configured - missing environment variables');
        }
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

    /**
     * Send text message via Green API
     * @param {string} phone - Recipient phone number (E.164 format)
     * @param {string} message - Message text
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Send result
     */
    async sendTextMessage(phone, message, options = {}) {
        const { maxRetries = 2, retryDelay = 1000 } = options;

        // Validate configuration
        if (!this.isConfigured) {
            return {
                success: false,
                error: 'Green API not configured',
                code: 'PROVIDER_NOT_CONFIGURED',
                details: 'Missing environment variables'
            };
        }

        // Validate phone number
        const phoneValidation = this.validatePhone(phone);
        if (!phoneValidation.valid) {
            return {
                success: false,
                error: phoneValidation.error,
                code: 'INVALID_PHONE_FORMAT',
                details: `Expected E.164 format, got: ${phone}`
            };
        }

        // Validate message
        if (!message || message.trim().length === 0) {
            return {
                success: false,
                error: 'Message cannot be empty',
                code: 'EMPTY_MESSAGE',
                details: 'Message text is required'
            };
        }

        const url = `${this.apiUrl}/instances/${this.instanceId}/sendMessage/${this.apiToken}`;
        const payload = {
            phone: phone,
            message: message.trim()
        };

        console.log(`📤 Sending message to ${this.maskPhone(phone)} via Green API`);
        console.log(`📝 Message preview: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

        // Retry logic with exponential backoff
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'University-Ticketing-System/1.0'
                    },
                    body: JSON.stringify(payload),
                    timeout: 10000 // 10 second timeout
                });

                const responseText = await response.text();
                let responseData;

                try {
                    responseData = JSON.parse(responseText);
                } catch (parseError) {
                    console.error('❌ Failed to parse Green API response:', responseText);
                    return {
                        success: false,
                        error: 'Invalid response from Green API',
                        code: 'INVALID_RESPONSE',
                        details: `Status: ${response.status}, Body: ${responseText.substring(0, 200)}`
                    };
                }

                // Log response (masked)
                console.log(`📥 Green API response (attempt ${attempt + 1}):`, {
                    status: response.status,
                    success: responseData.success,
                    messageId: responseData.idMessage,
                    phone: this.maskPhone(phone)
                });

                if (response.ok && responseData.success) {
                    return {
                        success: true,
                        messageId: responseData.idMessage,
                        status: response.status,
                        provider: 'greenapi',
                        phone: phone,
                        message: message
                    };
                }

                // Handle specific error codes
                if (response.status === 401 || response.status === 403) {
                    return {
                        success: false,
                        error: 'Authentication failed',
                        code: 'AUTH_ERROR',
                        provider: 'greenapi',
                        details: 'Invalid API token or instance ID'
                    };
                }

                if (response.status === 429) {
                    if (attempt < maxRetries) {
                        const delay = retryDelay * Math.pow(2, attempt);
                        console.log(`⏳ Rate limited, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    return {
                        success: false,
                        error: 'Rate limit exceeded',
                        code: 'RATE_LIMIT',
                        provider: 'greenapi',
                        details: 'Too many requests, please try again later'
                    };
                }

                if (response.status >= 400 && response.status < 500) {
                    return {
                        success: false,
                        error: 'Client error',
                        code: 'CLIENT_ERROR',
                        provider: 'greenapi',
                        details: responseData.message || `HTTP ${response.status}`,
                        status: response.status
                    };
                }

                if (response.status >= 500) {
                    if (attempt < maxRetries) {
                        const delay = retryDelay * Math.pow(2, attempt);
                        console.log(`⏳ Server error, retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    return {
                        success: false,
                        error: 'Server error',
                        code: 'SERVER_ERROR',
                        provider: 'greenapi',
                        details: responseData.message || `HTTP ${response.status}`,
                        status: response.status
                    };
                }

                // Unexpected response
                return {
                    success: false,
                    error: 'Unexpected response',
                    code: 'UNEXPECTED_RESPONSE',
                    provider: 'greenapi',
                    details: `Status: ${response.status}, Body: ${responseText.substring(0, 200)}`
                };

            } catch (error) {
                console.error(`❌ Green API request failed (attempt ${attempt + 1}):`, error.message);
                
                if (attempt < maxRetries) {
                    const delay = retryDelay * Math.pow(2, attempt);
                    console.log(`⏳ Network error, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                return {
                    success: false,
                    error: 'Network error',
                    code: 'NETWORK_ERROR',
                    provider: 'greenapi',
                    details: error.message
                };
            }
        }

        // This should never be reached, but just in case
        return {
            success: false,
            error: 'Max retries exceeded',
            code: 'MAX_RETRIES_EXCEEDED',
            provider: 'greenapi',
            details: 'All retry attempts failed'
        };
    }

    /**
     * Send media message via Green API
     * @param {string} phone - Recipient phone number (E.164 format)
     * @param {string} mediaUrl - URL to media file
     * @param {string} caption - Caption text
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Send result
     */
    async sendMediaMessage(phone, mediaUrl, caption = '', options = {}) {
        // Validate configuration
        if (!this.isConfigured) {
            return {
                success: false,
                error: 'Green API not configured',
                code: 'PROVIDER_NOT_CONFIGURED',
                details: 'Missing environment variables'
            };
        }

        // Validate phone number
        const phoneValidation = this.validatePhone(phone);
        if (!phoneValidation.valid) {
            return {
                success: false,
                error: phoneValidation.error,
                code: 'INVALID_PHONE_FORMAT',
                details: `Expected E.164 format, got: ${phone}`
            };
        }

        const url = `${this.apiUrl}/instances/${this.instanceId}/sendFileByUrl/${this.apiToken}`;
        const payload = {
            phone: phone,
            urlFile: mediaUrl,
            fileName: 'media',
            caption: caption || ''
        };

        console.log(`📤 Sending media to ${this.maskPhone(phone)} via Green API`);
        console.log(`📎 Media URL: ${mediaUrl}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'University-Ticketing-System/1.0'
                },
                body: JSON.stringify(payload),
                timeout: 15000 // 15 second timeout for media
            });

            const responseText = await response.text();
            let responseData;

            try {
                responseData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ Failed to parse Green API media response:', responseText);
                return {
                    success: false,
                    error: 'Invalid response from Green API',
                    code: 'INVALID_RESPONSE',
                    details: `Status: ${response.status}, Body: ${responseText.substring(0, 200)}`
                };
            }

            console.log(`📥 Green API media response:`, {
                status: response.status,
                success: responseData.success,
                messageId: responseData.idMessage,
                phone: this.maskPhone(phone)
            });

            if (response.ok && responseData.success) {
                return {
                    success: true,
                    messageId: responseData.idMessage,
                    status: response.status,
                    provider: 'greenapi',
                    phone: phone,
                    mediaUrl: mediaUrl,
                    caption: caption
                };
            }

            return {
                success: false,
                error: 'Failed to send media',
                code: 'MEDIA_SEND_FAILED',
                provider: 'greenapi',
                details: responseData.message || `HTTP ${response.status}`,
                status: response.status
            };

        } catch (error) {
            console.error('❌ Green API media request failed:', error.message);
            return {
                success: false,
                error: 'Network error',
                code: 'NETWORK_ERROR',
                provider: 'greenapi',
                details: error.message
            };
        }
    }

    /**
     * Check if service is properly configured
     * @returns {boolean} - Configuration status
     */
    isServiceConfigured() {
        return this.isConfigured;
    }

    /**
     * Get service status information
     * @returns {Object} - Status information
     */
    getStatus() {
        return {
            configured: this.isConfigured,
            apiUrl: this.apiUrl,
            instanceId: this.instanceId,
            instancePhone: this.maskPhone(this.instancePhone),
            hasToken: !!this.apiToken
        };
    }
}

// Export singleton instance
module.exports = new GreenAPIService();
