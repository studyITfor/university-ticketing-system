// Using built-in fetch (Node.js 18+)

async function testPaymentFlow() {
    console.log('🧪 Testing payment flow...');
    
    try {
        // Test 1: Health check
        console.log('\n1. Testing health endpoint...');
        const healthResponse = await fetch('http://localhost:3000/api/health');
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
        
        // Test 2: User payment confirmation
        console.log('\n2. Testing user payment confirmation...');
        const paymentData = {
            seatId: '1-5',
            studentName: 'Test Student',
            phone: '+996555123456'
        };
        
        const paymentResponse = await fetch('http://localhost:3000/api/user-payment-confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });
        
        const paymentResult = await paymentResponse.json();
        console.log('✅ Payment confirmation result:', paymentResult);
        
        if (paymentResult.success && paymentResult.bookingId) {
            // Test 3: Admin confirmation
            console.log('\n3. Testing admin confirmation...');
            const adminResponse = await fetch('http://localhost:3000/api/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bookingId: paymentResult.bookingId
                })
            });
            
            const adminResult = await adminResponse.json();
            console.log('✅ Admin confirmation result:', adminResult);
        }
        
        // Test 4: Check seat statuses
        console.log('\n4. Testing seat statuses...');
        const seatResponse = await fetch('http://localhost:3000/api/seat-statuses');
        const seatData = await seatResponse.json();
        console.log('✅ Seat statuses:', seatData.seatStatuses['1-5']);
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPaymentFlow();
