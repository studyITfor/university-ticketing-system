const { chromium } = require('playwright');

async function testDeletion() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('🚀 Starting deletion test...');
        
        // Navigate to the admin panel
        await page.goto('http://localhost:3000/admin.html');
        await page.waitForTimeout(2000);
        
        // Check if we can access the admin panel
        const title = await page.title();
        console.log('📄 Page title:', title);
        
        // Look for existing bookings
        const bookingRows = await page.$$('tbody tr');
        console.log(`📊 Found ${bookingRows.length} booking rows`);
        
        if (bookingRows.length > 0) {
            // Try to delete the first booking
            const deleteButton = await page.$('button[onclick*="deleteBooking"]');
            if (deleteButton) {
                console.log('🔍 Found delete button, attempting deletion...');
                
                // Click delete button
                await deleteButton.click();
                await page.waitForTimeout(1000);
                
                // Check if confirmation dialog appears (it's a browser confirm dialog)
                // We need to handle it before it appears
                page.on('dialog', async dialog => {
                    console.log('✅ Confirmation dialog appeared:', dialog.message());
                    await dialog.accept();
                    console.log('✅ Confirmation accepted');
                });
                
                await page.waitForTimeout(2000);
                console.log('✅ Deletion attempt completed');
            } else {
                console.log('❌ No delete button found');
                
                // Let's check what buttons are actually there
                const buttons = await page.$$('button');
                console.log(`📊 Found ${buttons.length} buttons total`);
                
                for (let i = 0; i < buttons.length; i++) {
                    const text = await buttons[i].textContent();
                    const onclick = await buttons[i].getAttribute('onclick');
                    console.log(`Button ${i}: "${text}" onclick="${onclick}"`);
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

testDeletion().catch(console.error);
