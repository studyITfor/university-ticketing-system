// tests/e2e/diagnose-confirm-code-error.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Diagnose Confirm Code Internal Error', () => {
  test('reproduce confirmation code error and capture diagnostics', async ({ page }) => {
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
    
    // Capture the diagnostics
    const diagnostics = {
      consoleLogs,
      networkRequests,
      networkResponses,
      testData,
      timestamp: new Date().toISOString()
    };
    
    // Log the diagnostics for analysis
    console.log('=== DIAGNOSTIC DATA ===');
    console.log('Console Logs:', JSON.stringify(consoleLogs, null, 2));
    console.log('Network Requests:', JSON.stringify(networkRequests, null, 2));
    console.log('Network Responses:', JSON.stringify(networkResponses, null, 2));
    
    // Check if there are any error responses
    const errorResponses = networkResponses.filter(r => r.status >= 400);
    if (errorResponses.length > 0) {
      console.log('=== ERROR RESPONSES FOUND ===');
      errorResponses.forEach(error => {
        console.log(`Error ${error.status} for ${error.url}`);
      });
    }
    
    // Check for console errors
    const consoleErrors = consoleLogs.filter(log => log.type === 'error');
    if (consoleErrors.length > 0) {
      console.log('=== CONSOLE ERRORS FOUND ===');
      consoleErrors.forEach(error => {
        console.log(`Console Error: ${error.text}`);
      });
    }
    
    // The test should pass even if there are errors - we're just capturing diagnostics
    expect(true).toBe(true);
  });
});
