const { chromium } = require('playwright');

async function testWhatsAppDelivery() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    const baseUrl = 'http://localhost:3000';
    
    try {
        console.log('🧪 Testing WhatsApp Delivery System...');
        console.log(`🌐 URL: ${baseUrl}`);
        
        // Test 1: Health Check
        console.log('1. Testing Health Check...');
        const healthResponse = await page.request.get(`${baseUrl}/api/health`);
        const healthData = await healthResponse.json();
        console.log(`✅ Health Check: ${healthResponse.status()} - ${healthData.status}`);
        
        // Test 2: Invalid Phone Validation
        console.log('2. Testing Invalid Phone Validation...');
        try {
            await page.request.post(`${baseUrl}/api/create-booking`, {
                data: {
                    firstName: 'Test',
                    lastName: 'User',
                    studentId: '12345',
                    phone: '123456789', // Invalid - no +
                    table: 1,
                    seat: 10
                }
            });
            console.log('❌ Invalid phone was accepted (should be rejected)');
        } catch (error) {
            console.log('✅ Invalid phone correctly rejected');
        }
        
        // Test 3: Valid Phone Booking Creation
        console.log('3. Testing Valid Phone Booking Creation...');
        const bookingResponse = await page.request.post(`${baseUrl}/api/create-booking`, {
            data: {
                firstName: 'WhatsApp',
                lastName: 'Test',
                studentId: '12345',
                phone: '+996777123456', // Valid international format
                table: 1,
                seat: 11
            }
        });
        const bookingData = await bookingResponse.json();
        console.log(`✅ Booking created: ${bookingData.bookingId}`);
        
        // Test 4: Payment Confirmation with WhatsApp
        console.log('4. Testing Payment Confirmation with WhatsApp...');
        const paymentResponse = await page.request.post(`${baseUrl}/api/confirm-payment`, {
            data: {
                bookingId: bookingData.bookingId
            }
        });
        const paymentData = await paymentResponse.json();
        console.log(`✅ Payment confirmed: ${paymentData.message}`);
        
        // Test 5: WhatsApp Delivery Status
        console.log('5. Testing WhatsApp Delivery Status...');
        if (paymentData.whatsappDelivery) {
            console.log('📊 WhatsApp Delivery Details:');
            console.log(`   Success: ${paymentData.whatsappDelivery.success}`);
            console.log(`   Attempts: ${paymentData.whatsappDelivery.attempts}`);
            console.log(`   Duration: ${paymentData.whatsappDelivery.duration}ms`);
            console.log(`   Message ID: ${paymentData.whatsappDelivery.messageId || 'N/A'}`);
            console.log(`   File ID: ${paymentData.whatsappDelivery.fileId || 'N/A'}`);
            if (paymentData.whatsappDelivery.lastError) {
                console.log(`   Last Error: ${paymentData.whatsappDelivery.lastError}`);
            }
        } else {
            console.log('❌ No WhatsApp delivery status in response');
        }
        
        // Test 6: Admin Panel Access
        console.log('6. Testing Admin Panel Access...');
        await page.goto(`${baseUrl}/admin.html`);
        await page.waitForLoadState('networkidle');
        
        // Check if admin panel loads
        const adminTitle = await page.textContent('h1');
        if (adminTitle && adminTitle.includes('Admin')) {
            console.log('✅ Admin panel loaded successfully');
        } else {
            console.log('❌ Admin panel failed to load');
        }
        
        // Test 7: Student Portal Phone Input
        console.log('7. Testing Student Portal Phone Input...');
        await page.goto(`${baseUrl}/index.html`);
        await page.waitForLoadState('networkidle');
        
        // Check phone input placeholder
        const phoneInput = page.locator('#phone');
        const placeholder = await phoneInput.getAttribute('placeholder');
        if (placeholder && placeholder.includes('+')) {
            console.log('✅ Phone input has correct placeholder');
        } else {
            console.log('❌ Phone input placeholder is incorrect');
        }
        
        // Test 8: Phone Input Validation
        console.log('8. Testing Phone Input Validation...');
        await phoneInput.fill('123456789'); // Invalid format
        await phoneInput.blur();
        
        // Try to submit form (should show validation error)
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();
        
        // Check for validation error
        const errorMessage = await page.textContent('.error-message, .alert-danger, .invalid-feedback');
        if (errorMessage && errorMessage.includes('+')) {
            console.log('✅ Phone validation working correctly');
        } else {
            console.log('❌ Phone validation not working');
        }
        
        console.log('\n🎉 All WhatsApp delivery tests completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

// Run the test
testWhatsAppDelivery().catch(console.error);
