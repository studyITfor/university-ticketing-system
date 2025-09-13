const axios = require('axios');

async function testDeletion() {
    try {
        console.log('🚀 Testing deletion API...');
        
        // First create a booking
        console.log('📝 Creating test booking...');
        const bookingData = {
            firstName: 'Test',
            lastName: 'User',
            studentId: '12345',
            phone: '+1234567890',
            table: 3,
            seat: 1,
            paymentStatus: 'pending'
        };
        
        const createResponse = await axios.post('http://localhost:3000/api/create-booking', bookingData);
        console.log('✅ Booking created:', createResponse.data);
        
        const bookingId = createResponse.data.bookingId;
        console.log('📋 Booking ID:', bookingId);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now try to delete it
        console.log('🗑️ Testing deletion...');
        try {
            const deleteResponse = await axios.delete(`http://localhost:3000/api/delete-booking/${bookingId}`);
            console.log('✅ Deletion successful:', deleteResponse.data);
        } catch (deleteError) {
            console.log('❌ Deletion failed:', deleteError.response?.data || deleteError.message);
            console.log('Status:', deleteError.response?.status);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.response?.data || error.message);
    }
}

testDeletion().catch(console.error);
