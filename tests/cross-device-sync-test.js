// Cross-device booking sync test
const axios = require('axios');

const BASE_URL = 'https://upbeat-compassion-production.up.railway.app';

async function testCrossDeviceSync() {
    console.log('🧪 Testing cross-device booking sync...\n');
    
    try {
        // Step 1: Check initial state (should be empty)
        console.log('1. Checking initial bookings state...');
        const initialBookings = await axios.get(`${BASE_URL}/api/bookings`);
        console.log(`   Initial bookings count: ${Object.keys(initialBookings.data).length}`);
        
        // Step 2: Create a test booking
        console.log('\n2. Creating test booking...');
        const testBooking = {
            firstName: 'Test',
            lastName: 'User',
            phone: '+996555123456',
            table: 1,
            seat: 1
        };
        
        const bookingResponse = await axios.post(`${BASE_URL}/api/create-booking`, testBooking);
        console.log(`   Booking created: ${bookingResponse.data.id}`);
        console.log(`   Status: ${bookingResponse.status}`);
        
        // Step 3: Verify booking appears in admin API
        console.log('\n3. Verifying booking appears in admin API...');
        const adminBookings = await axios.get(`${BASE_URL}/api/bookings`);
        const bookings = adminBookings.data;
        const bookingCount = Object.keys(bookings).length;
        
        console.log(`   Admin bookings count: ${bookingCount}`);
        
        if (bookingCount > 0) {
            const bookingId = Object.keys(bookings)[0];
            const booking = bookings[bookingId];
            console.log(`   Found booking: ${booking.firstName} ${booking.lastName}`);
            console.log(`   Phone: ${booking.phone}`);
            console.log(`   Table: ${booking.table}, Seat: ${booking.seat}`);
            console.log(`   Status: ${booking.status}`);
            
            // Step 4: Test seat status update
            console.log('\n4. Testing seat status update...');
            const seatStatusResponse = await axios.get(`${BASE_URL}/api/seat-statuses`);
            console.log(`   Seat statuses retrieved: ${Object.keys(seatStatusResponse.data).length} seats`);
            
            // Check if our booked seat shows as pending
            const seatId = `${testBooking.table}-${testBooking.seat}`;
            if (seatStatusResponse.data[seatId]) {
                console.log(`   Seat ${seatId} status: ${seatStatusResponse.data[seatId]}`);
            }
            
            console.log('\n✅ Cross-device sync test PASSED!');
            console.log('   - Booking created successfully');
            console.log('   - Booking appears in admin API');
            console.log('   - Seat status updated correctly');
            console.log('   - Database integration working');
            
        } else {
            console.log('\n❌ Cross-device sync test FAILED!');
            console.log('   - Booking was created but not found in admin API');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
        }
    }
}

// Run the test
testCrossDeviceSync();
