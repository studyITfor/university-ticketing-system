// tests/e2e/confirm-code-fix-verification.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Confirm Code Fix Verification', () => {
  test('should handle WhatsApp provider not configured gracefully in development', async ({ page }) => {
    // Capture console logs and network requests
    const consoleLogs = [];
    const networkRequests = [];
    const networkResponses = [];
    
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        networkResponses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    
    // Click on an available table area
    const availableTableArea = page.locator('.table-area:not(.booked)').first();
    await availableTableArea.click();
    
    // Wait for booking modal
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    // Fill out the booking form
    const timestamp = Date.now();
    const testData = {
      firstName: `Test${timestamp}`,
      lastName: `User${timestamp}`,
      phone: `+1234567${timestamp.toString().slice(-4)}`
    };
    
    await page.fill('#firstName', testData.firstName);
    await page.fill('#lastName', testData.lastName);
    await page.fill('#phone', testData.phone);
    await page.check('#whatsappOptin');
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for confirmation code modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Wait a moment for any async operations
    await page.waitForTimeout(2000);
    
    // Check that the confirmation code modal is visible
    await expect(page.locator('#confirmationCodeModal')).toBeVisible();
    
    // Check that the confirmation code field is populated (development mode)
    const confirmationCodeValue = await page.inputValue('#confirmationCode');
    expect(confirmationCodeValue).toBeTruthy();
    expect(confirmationCodeValue.length).toBe(6);
    
    // Check for development mode message
    const infoMessage = page.locator('#confirmationMessage.info');
    if (await infoMessage.isVisible()) {
      const messageText = await infoMessage.textContent();
      expect(messageText).toContain('Development mode');
      expect(messageText).toContain('Confirmation code is');
    }
    
    // Verify no console errors occurred
    const consoleErrors = consoleLogs.filter(log => log.type === 'error');
    expect(consoleErrors).toHaveLength(0);
    
    // Verify the opt-in API call returned success
    const optinResponse = networkResponses.find(r => r.url.includes('/api/optin'));
    expect(optinResponse).toBeTruthy();
    expect(optinResponse.status).toBe(200);
    
    console.log('✅ WhatsApp provider not configured handled gracefully in development mode');
  });

  test('should handle WhatsApp provider errors gracefully', async ({ page }) => {
    // Mock a WhatsApp provider error response
    await page.route('**/api/optin', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'WhatsApp service is temporarily unavailable',
          code: 'WHATSAPP_SERVICE_UNAVAILABLE',
          details: 'Service configuration issue'
        }),
      });
    });

    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    
    // Click on an available table area
    const availableTableArea = page.locator('.table-area:not(.booked)').first();
    await availableTableArea.click();
    
    // Wait for booking modal
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    // Fill out the booking form
    const timestamp = Date.now();
    const testData = {
      firstName: `Test${timestamp}`,
      lastName: `User${timestamp}`,
      phone: `+1234567${timestamp.toString().slice(-4)}`
    };
    
    await page.fill('#firstName', testData.firstName);
    await page.fill('#lastName', testData.lastName);
    await page.fill('#phone', testData.phone);
    await page.check('#whatsappOptin');
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for error message to appear
    await page.waitForSelector('.optin-message.error', { state: 'visible' });
    
    // Check that error message is displayed
    const errorMessage = page.locator('.optin-message.error');
    await expect(errorMessage).toBeVisible();
    
    const messageText = await errorMessage.textContent();
    expect(messageText).toContain('Ошибка при отправке кода подтверждения');
    
    // Verify no console errors occurred (should be handled gracefully)
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Wait a moment for any async operations
    await page.waitForTimeout(2000);
    
    const consoleErrors = consoleLogs.filter(log => log.type === 'error');
    expect(consoleErrors).toHaveLength(0);
    
    console.log('✅ WhatsApp provider error handled gracefully');
  });
});
