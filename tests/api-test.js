const axios = require('axios');

async function testDeletionAPI() {
    const baseURL = 'http://localhost:3000';
    
    try {
        console.log('🚀 Testing booking deletion API...');
        
        // Step 1: Create a test booking
        console.log('📝 Step 1: Creating test booking...');
        const bookingData = {
            firstName: 'Test',
            lastName: 'User',
            studentId: '12345',
            phone: '+996555123456',
            table: 1,
            seat: 1,
            paymentStatus: 'pending'
        };
        
        const createResponse = await axios.post(`${baseURL}/api/create-booking`, bookingData);
        console.log('✅ Booking created:', createResponse.data);
        
        const bookingId = createResponse.data.bookingId;
        console.log('📋 Booking ID:', bookingId);
        
        // Step 2: Verify booking exists
        console.log('🔍 Step 2: Verifying booking exists...');
        const getResponse = await axios.get(`${baseURL}/api/bookings`);
        console.log('📊 Current bookings:', getResponse.data);
        
        // Step 3: Test deletion
        console.log('🗑️ Step 3: Testing deletion...');
        try {
            const deleteResponse = await axios.delete(`${baseURL}/api/delete-booking/${bookingId}`);
            console.log('✅ Deletion successful:', deleteResponse.data);
        } catch (deleteError) {
            console.log('❌ Deletion failed:', deleteError.response?.data || deleteError.message);
        }
        
        // Step 4: Verify booking is deleted
        console.log('🔍 Step 4: Verifying booking is deleted...');
        const finalResponse = await axios.get(`${baseURL}/api/bookings`);
        console.log('📊 Final bookings:', finalResponse.data);
        
        console.log('✅ Test completed');
        
    } catch (error) {
        console.error('❌ Test error:', error.response?.data || error.message);
    }
}

testDeletionAPI().catch(console.error);
