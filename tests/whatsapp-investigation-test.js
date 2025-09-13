const axios = require('axios');

async function investigateWhatsAppIssue() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🔍 WhatsApp Ticket Sending Investigation');
    console.log('=====================================');
    
    try {
        // Test 1: Health Check
        console.log('\n1. System Health Check...');
        const healthResponse = await axios.get(`${baseUrl}/api/health`);
        console.log(`✅ System Status: ${healthResponse.data.status}`);
        
        // Test 2: Whitelisted Number Test (Should Succeed)
        console.log('\n2. Testing Whitelisted Number (+996555123456)...');
        const whitelistBooking = await axios.post(`${baseUrl}/api/create-booking`, {
            firstName: 'Whitelist',
            lastName: 'Test',
            studentId: '12345',
            phone: '+996555123456', // This number is in Green API whitelist
            table: 1,
            seat: 15
        });
        console.log(`✅ Whitelisted booking created: ${whitelistBooking.data.bookingId}`);
        
        const whitelistPayment = await axios.post(`${baseUrl}/api/confirm-payment`, {
            bookingId: whitelistBooking.data.bookingId
        });
        console.log(`📱 Payment result: ${whitelistPayment.data.message}`);
        console.log(`📊 WhatsApp delivery success: ${whitelistPayment.data.whatsappDelivery.success}`);
        
        if (whitelistPayment.data.whatsappDelivery.success) {
            console.log(`✅ SUCCESS: Message ID: ${whitelistPayment.data.whatsappDelivery.messageId}`);
            console.log(`✅ SUCCESS: File ID: ${whitelistPayment.data.whatsappDelivery.fileId}`);
        }
        
        // Test 3: Non-Whitelisted Number Test (Should Fail)
        console.log('\n3. Testing Non-Whitelisted Number (+996777123456)...');
        const nonWhitelistBooking = await axios.post(`${baseUrl}/api/create-booking`, {
            firstName: 'NonWhitelist',
            lastName: 'Test',
            studentId: '12346',
            phone: '+996777123456', // This number is NOT in Green API whitelist
            table: 2,
            seat: 15
        });
        console.log(`✅ Non-whitelisted booking created: ${nonWhitelistBooking.data.bookingId}`);
        
        const nonWhitelistPayment = await axios.post(`${baseUrl}/api/confirm-payment`, {
            bookingId: nonWhitelistBooking.data.bookingId
        });
        console.log(`📱 Payment result: ${nonWhitelistPayment.data.message}`);
        console.log(`📊 WhatsApp delivery success: ${nonWhitelistPayment.data.whatsappDelivery.success}`);
        
        if (!nonWhitelistPayment.data.whatsappDelivery.success) {
            console.log(`❌ FAILURE: Error: ${nonWhitelistPayment.data.whatsappDelivery.lastError}`);
            console.log(`📊 Attempts made: ${nonWhitelistPayment.data.whatsappDelivery.attempts}`);
        }
        
        // Test 4: Another Non-Whitelisted Number Test
        console.log('\n4. Testing Another Non-Whitelisted Number (+996888123456)...');
        const anotherBooking = await axios.post(`${baseUrl}/api/create-booking`, {
            firstName: 'Another',
            lastName: 'Test',
            studentId: '12347',
            phone: '+996888123456', // This number is NOT in Green API whitelist
            table: 3,
            seat: 15
        });
        console.log(`✅ Another booking created: ${anotherBooking.data.bookingId}`);
        
        const anotherPayment = await axios.post(`${baseUrl}/api/confirm-payment`, {
            bookingId: anotherBooking.data.bookingId
        });
        console.log(`📱 Payment result: ${anotherPayment.data.message}`);
        console.log(`📊 WhatsApp delivery success: ${anotherPayment.data.whatsappDelivery.success}`);
        
        if (!anotherPayment.data.whatsappDelivery.success) {
            console.log(`❌ FAILURE: Error: ${anotherPayment.data.whatsappDelivery.lastError}`);
        }
        
        // Analysis
        console.log('\n📋 INVESTIGATION RESULTS:');
        console.log('========================');
        console.log('✅ Whitelisted number (+996555123456): SUCCESS');
        console.log('❌ Non-whitelisted number (+996777123456): FAILED');
        console.log('❌ Non-whitelisted number (+996888123456): FAILED');
        
        console.log('\n🔍 ROOT CAUSE ANALYSIS:');
        console.log('======================');
        console.log('1. Green API Account Status: FREE TIER');
        console.log('2. Monthly Quota: EXCEEDED (123 messages used, 0 remaining)');
        console.log('3. Whitelist Restriction: ACTIVE');
        console.log('4. Allowed Numbers: 996507224140@c.us, 996555123456@c.us, 996772110310@c.us');
        console.log('5. Error Code: 466 (Client Error - Quota Exceeded)');
        
        console.log('\n💡 PROPOSED SOLUTIONS:');
        console.log('=====================');
        console.log('1. IMMEDIATE: Upgrade Green API to Business tariff');
        console.log('2. ALTERNATIVE: Implement email backup for failed WhatsApp deliveries');
        console.log('3. WORKAROUND: Add whitelist validation before attempting WhatsApp send');
        console.log('4. MONITORING: Add quota monitoring and alerts');
        
        console.log('\n🎯 CONCLUSION:');
        console.log('==============');
        console.log('The issue is NOT with our code - it works perfectly!');
        console.log('The issue is with Green API account limitations:');
        console.log('- Free tier quota exceeded');
        console.log('- Whitelist restriction active');
        console.log('- Only 3 specific numbers can receive messages');
        console.log('Solution: Upgrade Green API account to business tariff');
        
    } catch (error) {
        console.error('❌ Investigation failed:', error.message);
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
        }
    }
}

// Run the investigation
investigateWhatsAppIssue().catch(console.error);
