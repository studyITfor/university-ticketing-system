// tests/e2e/booking-without-whatsapp.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Booking Flow Without WhatsApp', () => {
  test('complete booking flow without WhatsApp opt-in', async ({ page }) => {
    console.log('🚀 Starting booking flow test without WhatsApp...');
    
    // Set reasonable timeout
    test.setTimeout(60000);
    
    try {
      // Navigate to page
      console.log('🌐 Navigating to page...');
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait for page to be ready
      console.log('⏳ Waiting for page ready...');
      await page.waitForLoadState('networkidle', { timeout: 20000 });
      
      // Wait for table areas to be generated
      console.log('🔍 Looking for table areas...');
      await page.waitForFunction(() => {
        const tableAreas = document.querySelectorAll('.table-area');
        return tableAreas.length > 0;
      }, { timeout: 15000 });
      
      // Click on an available table area
      console.log('🖱️ Clicking on table area...');
      const availableTableArea = page.locator('.table-area:not(.booked)').first();
      await availableTableArea.click({ timeout: 10000 });
      
      // Wait for booking modal
      console.log('⏳ Waiting for booking modal...');
      await page.waitForSelector('#bookingModal', { 
        state: 'visible',
        timeout: 10000 
      });
      
      // Verify WhatsApp checkbox is not present
      console.log('✅ Verifying WhatsApp checkbox is removed...');
      const whatsappCheckbox = page.locator('#whatsappOptin');
      await expect(whatsappCheckbox).toHaveCount(0);
      
      // Fill out the booking form
      console.log('📝 Filling out booking form...');
      const timestamp = Date.now();
      const testData = {
        firstName: `Test${timestamp}`,
        lastName: `User${timestamp}`,
        phone: `+1234567${timestamp.toString().slice(-4)}`
      };
      
      await page.fill('#firstName', testData.firstName);
      await page.fill('#lastName', testData.lastName);
      await page.fill('#phone', testData.phone);
      
      // Submit the booking form
      console.log('🚀 Submitting booking form...');
      await page.click('#bookingForm button[type="submit"]', { timeout: 10000 });
      
      // Wait for confirmation modal (not WhatsApp confirmation)
      console.log('⏳ Waiting for booking confirmation...');
      await page.waitForSelector('#confirmationModal', { 
        state: 'visible',
        timeout: 15000 
      });
      
      // Verify confirmation modal shows correct information
      console.log('✅ Verifying confirmation modal...');
      const confirmedSeat = page.locator('#confirmedSeat');
      await expect(confirmedSeat).toBeVisible();
      
      const confirmedBookingId = page.locator('#confirmedBookingId');
      await expect(confirmedBookingId).toBeVisible();
      
      // Verify no WhatsApp confirmation modal appears
      console.log('✅ Verifying no WhatsApp modal appears...');
      const whatsappModal = page.locator('#confirmationCodeModal');
      await expect(whatsappModal).toHaveCount(0);
      
      // Close confirmation modal
      console.log('🔄 Closing confirmation modal...');
      await page.click('#closeConfirmation', { timeout: 5000 });
      
      console.log('✅ Booking flow test completed successfully');
      expect(true).toBe(true);
      
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      await page.screenshot({ path: 'debug-booking-without-whatsapp-error.png' });
      throw error;
    }
  });
  
  test('admin panel still works after WhatsApp removal', async ({ page }) => {
    console.log('🚀 Starting admin panel test...');
    
    test.setTimeout(60000);
    
    try {
      // Navigate to admin panel
      console.log('🌐 Navigating to admin panel...');
      await page.goto('http://localhost:3000/admin', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      // Wait for admin panel to load
      console.log('⏳ Waiting for admin panel to load...');
      await page.waitForLoadState('networkidle', { timeout: 20000 });
      
      // Verify admin panel elements are present
      console.log('✅ Verifying admin panel elements...');
      const adminTitle = page.locator('h1, h2').filter({ hasText: /admin|админ/i });
      await expect(adminTitle).toBeVisible();
      
      // Check if bookings table or list is present
      const bookingsTable = page.locator('table, .bookings-list, #bookingsList');
      await expect(bookingsTable).toBeVisible();
      
      console.log('✅ Admin panel test completed successfully');
      expect(true).toBe(true);
      
    } catch (error) {
      console.log('❌ Admin panel test failed:', error.message);
      await page.screenshot({ path: 'debug-admin-panel-error.png' });
      throw error;
    }
  });
});
