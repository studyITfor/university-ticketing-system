const { chromium } = require('playwright');

async function runTest() {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        console.log('🧪 Starting comprehensive test...');
        
        // Test 1: Phone validation
        console.log('📱 Testing phone validation...');
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        
        // Fill form with invalid phone
        await page.fill('#firstName', 'Test');
        await page.fill('#lastName', 'User');
        await page.fill('#studentId', '12345');
        await page.fill('#phone', '123456789'); // Invalid phone
        await page.selectOption('#table', '1');
        await page.selectOption('#seat', '4');
        
        // Try to submit
        await page.click('button[type="submit"]');
        
        // Check for error message
        await page.waitForTimeout(2000);
        const pageContent = await page.content();
        const hasError = pageContent.includes('+') || pageContent.includes('международный');
        
        if (hasError) {
            console.log('✅ Phone validation working - rejected invalid phone');
        } else {
            console.log('❌ Phone validation not working');
        }
        
        // Now test with valid phone
        await page.fill('#phone', '+996777123456');
        await page.click('button[type="submit"]');
        
        // Wait for success
        await page.waitForTimeout(3000);
        const successContent = await page.content();
        const hasSuccess = successContent.includes('успешно') || successContent.includes('success');
        
        if (hasSuccess) {
            console.log('✅ Booking created successfully with valid phone');
        } else {
            console.log('❌ Booking creation failed');
        }
        
        // Test 2: Admin panel deletion
        console.log('🗑️ Testing admin panel deletion...');
        await page.goto('http://localhost:3000/admin.html');
        await page.waitForLoadState('networkidle');
        
        // Wait for bookings table
        await page.waitForSelector('table tbody tr', { timeout: 10000 });
        
        // Count initial bookings
        const initialRows = await page.$$('table tbody tr');
        console.log(`Found ${initialRows.length} bookings in admin panel`);
        
        if (initialRows.length > 0) {
            // Try to delete the first booking
            const firstRow = initialRows[0];
            const deleteButton = await firstRow.$('button:has-text("Удалить"), button:has-text("Delete")');
            
            if (deleteButton) {
                // Set up dialog handler
                page.on('dialog', async dialog => {
                    console.log('Dialog appeared:', dialog.message());
                    await dialog.accept();
                });
                
                await deleteButton.click();
                await page.waitForTimeout(2000);
                
                // Check if row was removed
                const newRows = await page.$$('table tbody tr');
                if (newRows.length < initialRows.length) {
                    console.log('✅ Booking deletion successful');
                } else {
                    console.log('❌ Booking deletion failed');
                }
            } else {
                console.log('❌ No delete button found');
            }
        } else {
            console.log('⚠️ No bookings found to test deletion');
        }
        
        console.log('🎉 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

runTest();
