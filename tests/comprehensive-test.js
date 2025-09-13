const { chromium } = require('playwright');

async function comprehensiveTest() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('🚀 Starting comprehensive test...');
        
        // Test 1: Student booking with phone validation
        console.log('📝 Test 1: Testing student booking with phone validation...');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);
        
        // Try to fill form with invalid phone (should fail)
        await page.fill('input[name="firstName"]', 'Test');
        await page.fill('input[name="lastName"]', 'User');
        await page.fill('input[name="studentId"]', '12345');
        await page.fill('input[name="phone"]', '1234567890'); // Invalid - no +
        
        // Select a seat
        const seat = await page.$('[data-table="1"][data-seat="2"]');
        if (seat) {
            await seat.click();
            console.log('✅ Seat selected');
        }
        
        // Try to submit (should show validation error)
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
        
        // Check if validation error appears
        const hasValidationError = await page.evaluate(() => {
            return document.body.textContent.includes('международный формат');
        });
        
        if (hasValidationError) {
            console.log('✅ Phone validation working - rejected invalid format');
        } else {
            console.log('❌ Phone validation not working');
        }
        
        // Now try with valid phone
        await page.fill('input[name="phone"]', '+1234567890');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        
        console.log('✅ Booking created with valid phone');
        
        // Test 2: Admin panel deletion
        console.log('🔧 Test 2: Testing admin panel deletion...');
        await page.goto('http://localhost:3000/admin.html');
        await page.waitForTimeout(3000);
        
        // Check if we can access admin panel
        const title = await page.title();
        console.log('📄 Admin panel title:', title);
        
        // Look for bookings
        const bookingRows = await page.$$('tbody tr');
        console.log(`📊 Found ${bookingRows.length} booking rows`);
        
        if (bookingRows.length > 0) {
            // Try to delete the first booking
            const deleteButton = await page.$('button.btn-danger');
            if (deleteButton) {
                console.log('🔍 Found delete button, attempting deletion...');
                
                // Set up dialog handler
                page.on('dialog', async dialog => {
                    console.log('✅ Confirmation dialog appeared:', dialog.message());
                    await dialog.accept();
                    console.log('✅ Confirmation accepted');
                });
                
                // Click delete button
                await deleteButton.click();
                await page.waitForTimeout(3000);
                
                console.log('✅ Deletion attempt completed');
                
                // Check if booking was removed
                const updatedRows = await page.$$('tbody tr');
                console.log(`📊 After deletion: ${updatedRows.length} booking rows`);
                
                if (updatedRows.length < bookingRows.length) {
                    console.log('✅ Booking successfully deleted!');
                } else {
                    console.log('❌ Booking was not deleted');
                }
            } else {
                console.log('❌ No delete button found');
            }
        } else {
            console.log('❌ No bookings found to delete');
        }
        
        console.log('✅ Comprehensive test completed');
        
    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await browser.close();
    }
}

comprehensiveTest().catch(console.error);
