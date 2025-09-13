const { chromium } = require('playwright');

async function testBookingDeletion() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('🚀 Starting booking creation and deletion test...');
        
        // Step 1: Create a booking
        console.log('📝 Step 1: Creating a test booking...');
        await page.goto('http://localhost:3000');
        await page.waitForTimeout(2000);
        
        // Fill booking form
        await page.fill('input[name="firstName"]', 'Test');
        await page.fill('input[name="lastName"]', 'User');
        await page.fill('input[name="studentId"]', '12345');
        await page.fill('input[name="phone"]', '+996555123456');
        
        // Select a seat (table 1, seat 1)
        const seat = await page.$('[data-table="1"][data-seat="1"]');
        if (seat) {
            await seat.click();
            console.log('✅ Seat selected');
        } else {
            console.log('❌ Seat not found');
            return;
        }
        
        // Submit booking
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        
        console.log('✅ Booking created');
        
        // Step 2: Go to admin panel and delete the booking
        console.log('🔧 Step 2: Testing deletion in admin panel...');
        await page.goto('http://localhost:3000/admin.html');
        await page.waitForTimeout(3000);
        
        // Check if we can access the admin panel
        const title = await page.title();
        console.log('📄 Admin panel title:', title);
        
        // Look for bookings
        const bookingRows = await page.$$('tbody tr');
        console.log(`📊 Found ${bookingRows.length} booking rows`);
        
        if (bookingRows.length > 0) {
            // Look for delete button with more specific selector
            const deleteButton = await page.$('button.btn-danger');
            if (deleteButton) {
                console.log('🔍 Found delete button, attempting deletion...');
                
                // Set up dialog handler before clicking
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
                
                // Debug: show all buttons
                const buttons = await page.$$('button');
                console.log(`📊 Found ${buttons.length} buttons total`);
                
                for (let i = 0; i < Math.min(buttons.length, 10); i++) {
                    const text = await buttons[i].textContent();
                    const classes = await buttons[i].getAttribute('class');
                    console.log(`Button ${i}: "${text.trim()}" class="${classes}"`);
                }
            }
        } else {
            console.log('❌ No bookings found to delete');
        }
        
    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await browser.close();
    }
}

testBookingDeletion().catch(console.error);
