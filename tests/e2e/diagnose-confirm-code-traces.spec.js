// tests/e2e/diagnose-confirm-code-traces.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Diagnose Confirm Code Internal Error - Full Traces', () => {
  test('capture complete traces for confirm code error', async ({ page }) => {
    // Capture all network requests and responses
    const networkTraces = [];
    const consoleLogs = [];
    const pageErrors = [];
    
    // Capture network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        networkTraces.push({
          type: 'request',
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Capture network responses
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        const body = await response.text().catch(() => 'Failed to read response body');
        networkTraces.push({
          type: 'response',
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          body: body.substring(0, 1000), // First 1000 chars
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Capture console logs
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
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
    
    // Wait for confirmation code modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Wait a moment for any async operations
    await page.waitForTimeout(3000);
    
    // Capture all traces
    const traces = {
      networkTraces,
      consoleLogs,
      pageErrors,
      testData,
      timestamp: new Date().toISOString()
    };
    
    // Log the traces for analysis
    console.log('=== FULL DIAGNOSTIC TRACES ===');
    console.log('Network Traces:', JSON.stringify(networkTraces, null, 2));
    console.log('Console Logs:', JSON.stringify(consoleLogs, null, 2));
    console.log('Page Errors:', JSON.stringify(pageErrors, null, 2));
    
    // Check for specific error patterns
    const errorResponses = networkTraces.filter(t => t.type === 'response' && t.status >= 400);
    if (errorResponses.length > 0) {
      console.log('=== ERROR RESPONSES FOUND ===');
      errorResponses.forEach(error => {
        console.log(`Error ${error.status} for ${error.url}:`);
        console.log(`Response Body: ${error.body}`);
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
    
    // Check for page errors
    if (pageErrors.length > 0) {
      console.log('=== PAGE ERRORS FOUND ===');
      pageErrors.forEach(error => {
        console.log(`Page Error: ${error.message}`);
        console.log(`Stack: ${error.stack}`);
      });
    }
    
    // The test should pass even if there are errors - we're just capturing diagnostics
    expect(true).toBe(true);
  });
});
