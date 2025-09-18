const fetch = require('node-fetch');

async function testWhatsAppIntegration() {
    console.log('🧪 Testing WhatsApp integration...');
    
    try {
        // First, create a booking
        console.log('\n1. Creating a test booking...');
        const paymentData = {
            seatId: '2-3',
            studentName: 'WhatsApp Test User',
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
        console.log('✅ Booking created:', paymentResult.bookingId);
        
        if (paymentResult.success && paymentResult.bookingId) {
            // Now test admin confirmation with detailed logging
            console.log('\n2. Testing admin confirmation with WhatsApp...');
            console.log('📱 This should trigger WhatsApp sending...');
            
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
            
            // Check if ticket was generated
            if (adminResult.ticketPath) {
                console.log('📄 Ticket generated at:', adminResult.ticketPath);
                
                // Test if ticket is accessible
                const ticketUrl = `http://localhost:3000${adminResult.ticketPath}`;
                console.log('🔗 Testing ticket URL:', ticketUrl);
                
                try {
                    const ticketResponse = await fetch(ticketUrl);
                    if (ticketResponse.ok) {
                        console.log('✅ Ticket is accessible via URL');
                    } else {
                        console.log('❌ Ticket URL not accessible:', ticketResponse.status);
                    }
                } catch (e) {
                    console.log('❌ Error accessing ticket URL:', e.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testWhatsAppIntegration();

