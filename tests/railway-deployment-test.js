const { chromium } = require('playwright');

async function testRailwayDeployment() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    const baseUrl = 'https://goldenmiddle-production.up.railway.app';
    
    try {
        console.log('🧪 Testing Railway Deployment...');
        console.log(`🌐 URL: ${baseUrl}`);
        
        // Test 1: Health Check
        console.log('1. Testing Health Check...');
        const healthResponse = await page.request.get(`${baseUrl}/api/health`);
        const healthData = await healthResponse.json();
        console.log(`✅ Health Check: ${healthResponse.status()} - ${healthData.status}`);
        
        // Test 2: Student Portal
        console.log('2. Testing Student Portal...');
        await page.goto(`${baseUrl}/index.html`);
        await page.waitForLoadState('networkidle');
        
        // Check if phone input has correct placeholder
        const phoneInput = page.locator('#phone');
        const placeholder = await phoneInput.getAttribute('placeholder');
        console.log(`✅ Phone placeholder: "${placeholder}"`);
        
        // Test 3: Admin Panel
        console.log('3. Testing Admin Panel...');
        await page.goto(`${baseUrl}/admin.html`);
        await page.waitForLoadState('networkidle');
        
        // Check if admin panel loads
        const adminTitle = await page.textContent('h1');
        console.log(`✅ Admin Panel loaded: "${adminTitle}"`);
        
        // Test 4: API Endpoints
        console.log('4. Testing API Endpoints...');
        
        // Test invalid phone
        try {
            await page.request.post(`${baseUrl}/api/create-booking`, {
                data: {
                    firstName: 'Test',
                    lastName: 'User',
                    studentId: '12345',
                    phone: '123456789', // Invalid phone
                    table: 1,
                    seat: 10
                }
            });
        } catch (error) {
            console.log('✅ Invalid phone properly rejected');
        }
        
        // Test valid phone booking
        const bookingResponse = await page.request.post(`${baseUrl}/api/create-booking`, {
            data: {
                firstName: 'Test',
                lastName: 'User',
                studentId: '12345',
                phone: '+996777123456',
                table: 1,
                seat: 10
            }
        });
        
        const bookingData = await bookingResponse.json();
        console.log(`✅ Valid booking created: ${bookingData.bookingId}`);
        
        // Test payment confirmation
        const paymentResponse = await page.request.post(`${baseUrl}/api/confirm-payment`, {
            data: { bookingId: bookingData.bookingId }
        });
        
        const paymentData = await paymentResponse.json();
        console.log(`✅ Payment confirmed: ${paymentData.message}`);
        
        // Test deletion
        const deleteResponse = await page.request.delete(`${baseUrl}/api/delete-booking/${paymentData.ticketId}`);
        const deleteData = await deleteResponse.json();
        console.log(`✅ Booking deleted: ${deleteData.message} (wasPaid: ${deleteData.deletedBooking.wasPaid})`);
        
        console.log('🎉 All Railway deployment tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

testRailwayDeployment();
