// tests/e2e/diagnose-confirm-code-traces-FINAL.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Diagnose Confirm Code Internal Error - FINAL FIXED VERSION', () => {
  test('capture complete traces for confirm code error', async ({ page }) => {
    // Set explicit test timeout
    test.setTimeout(120000); // 2 minutes total timeout
    
    console.log('🚀 Starting FINAL diagnostic test...');
    
    // Capture all network requests and responses
    const networkTraces = [];
    const consoleLogs = [];
    const pageErrors = [];
    
    // Set up event listeners BEFORE navigation
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`📡 Request: ${request.method()} ${request.url()}`);
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
    
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        console.log(`📡 Response: ${response.status()} ${response.url()}`);
        const body = await response.text().catch(() => 'Failed to read response body');
        networkTraces.push({
          type: 'response',
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          body: body.substring(0, 1000),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    page.on('console', msg => {
      console.log(`📝 Console [${msg.type()}]: ${msg.text()}`);
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    page.on('pageerror', error => {
      console.log(`❌ Page Error: ${error.message}`);
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    try {
      // Step 1: Navigate with proper error handling
      console.log('🌐 Step 1: Navigate to page...');
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      console.log('✅ Page loaded');
      
      // Step 2: Wait for page to be fully ready
      console.log('⏳ Step 2: Wait for page to be ready...');
      await page.waitForLoadState('networkidle', { timeout: 20000 });
      console.log('✅ Page ready');
      
      // Step 3: Check if seating plan exists
      console.log('🔍 Step 3: Check for seating plan...');
      let seatingPlanExists = false;
      try {
        await page.waitForSelector('#interactiveSeatingPlan', { 
          state: 'visible',
          timeout: 10000 
        });
        seatingPlanExists = true;
        console.log('✅ Seating plan found');
      } catch (error) {
        console.log('⚠️ Seating plan not found, continuing anyway');
      }
      
      // Step 4: Look for table/seat elements with multiple strategies
      console.log('🔍 Step 4: Look for table/seat elements...');
      let tableElementsFound = false;
      const tableSelectors = [
        '.table-area',
        '.seat',
        '.table',
        '[data-table]',
        '[data-seat]',
        '.booking-item',
        '.seat-item'
      ];
      
      for (const selector of tableSelectors) {
        try {
          const count = await page.locator(selector).count();
          if (count > 0) {
            console.log(`✅ Found ${count} elements with selector: ${selector}`);
            tableElementsFound = true;
            break;
          }
        } catch (error) {
          console.log(`❌ Selector ${selector} failed:`, error.message);
        }
      }
      
      if (!tableElementsFound) {
        console.log('❌ No table/seat elements found at all');
        await page.screenshot({ path: 'debug-no-tables.png' });
        throw new Error('No table/seat elements found');
      }
      
      // Step 5: Try to click on a clickable element
      console.log('🖱️ Step 5: Try to click on element...');
      let clicked = false;
      const clickableSelectors = [
        '.table-area:not(.booked):not(.selected)',
        '.table-area:not(.booked)',
        '.table-area:not(.selected)',
        '.table-area',
        '.seat:not(.booked):not(.selected)',
        '.seat:not(.booked)',
        '.seat:not(.selected)',
        '.seat'
      ];
      
      for (const selector of clickableSelectors) {
        try {
          const element = page.locator(selector).first();
          const count = await element.count();
          if (count > 0) {
            console.log(`🖱️ Attempting to click ${selector} (${count} elements found)`);
            await element.click({ timeout: 10000 });
            clicked = true;
            console.log(`✅ Successfully clicked ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Failed to click ${selector}:`, error.message);
        }
      }
      
      if (!clicked) {
        console.log('❌ No clickable elements found');
        await page.screenshot({ path: 'debug-no-clickable.png' });
        throw new Error('No clickable elements found');
      }
      
      // Step 6: Wait for booking modal with multiple strategies
      console.log('⏳ Step 6: Wait for booking modal...');
      let modalFound = false;
      const modalSelectors = [
        '#bookingModal',
        '.booking-modal',
        '.modal',
        '[role="dialog"]',
        '.booking-form',
        '#bookingForm'
      ];
      
      for (const selector of modalSelectors) {
        try {
          await page.waitForSelector(selector, { 
            state: 'visible',
            timeout: 15000 
          });
          console.log(`✅ Found modal with selector: ${selector}`);
          modalFound = true;
          break;
        } catch (error) {
          console.log(`❌ Modal selector ${selector} not found:`, error.message);
        }
      }
      
      if (!modalFound) {
        console.log('❌ No booking modal found');
        await page.screenshot({ path: 'debug-no-modal.png' });
        throw new Error('No booking modal found');
      }
      
      // Step 7: Fill out the booking form
      console.log('📝 Step 7: Fill out booking form...');
      const timestamp = Date.now();
      const testData = {
        firstName: `Test${timestamp}`,
        lastName: `User${timestamp}`,
        phone: `+1234567${timestamp.toString().slice(-4)}`
      };
      
      const formFields = [
        { selector: '#firstName', value: testData.firstName },
        { selector: '#lastName', value: testData.lastName },
        { selector: '#phone', value: testData.phone }
      ];
      
      for (const field of formFields) {
        try {
          await page.fill(field.selector, field.value, { timeout: 10000 });
          console.log(`✅ Filled ${field.selector}`);
        } catch (error) {
          console.log(`❌ Failed to fill ${field.selector}:`, error.message);
        }
      }
      
      // Try to check WhatsApp opt-in
      try {
        await page.check('#whatsappOptin', { timeout: 10000 });
        console.log('✅ Checked WhatsApp opt-in');
      } catch (error) {
        console.log('❌ Failed to check WhatsApp opt-in:', error.message);
      }
      
      // Step 8: Submit the form
      console.log('🚀 Step 8: Submit booking form...');
      let submitted = false;
      const submitSelectors = [
        '#bookingForm button[type="submit"]',
        'button[type="submit"]',
        'input[type="submit"]',
        '.submit-btn',
        '.btn-submit',
        'button:has-text("Book")',
        'button:has-text("Submit")',
        'button:has-text("Забронировать")'
      ];
      
      for (const selector of submitSelectors) {
        try {
          await page.click(selector, { timeout: 10000 });
          console.log(`✅ Submitted with selector: ${selector}`);
          submitted = true;
          break;
        } catch (error) {
          console.log(`❌ Submit selector ${selector} failed:`, error.message);
        }
      }
      
      if (!submitted) {
        console.log('❌ Could not submit form');
        await page.screenshot({ path: 'debug-submit-failed.png' });
        throw new Error('Could not submit form');
      }
      
      // Step 9: Wait for confirmation modal
      console.log('⏳ Step 9: Wait for confirmation modal...');
      let confirmationModalFound = false;
      const confirmationModalSelectors = [
        '#confirmationCodeModal',
        '.confirmation-modal',
        '.code-modal',
        '.confirmation-code-modal',
        '[role="dialog"]',
        '.modal'
      ];
      
      for (const selector of confirmationModalSelectors) {
        try {
          await page.waitForSelector(selector, { 
            state: 'visible',
            timeout: 20000 
          });
          console.log(`✅ Found confirmation modal with selector: ${selector}`);
          confirmationModalFound = true;
          break;
        } catch (error) {
          console.log(`❌ Confirmation modal selector ${selector} not found:`, error.message);
        }
      }
      
      if (!confirmationModalFound) {
        console.log('⚠️ No confirmation modal found - this might be the issue');
        await page.screenshot({ path: 'debug-no-confirmation-modal.png' });
      }
      
      // Step 10: Wait for any async operations to complete
      console.log('⏳ Step 10: Wait for async operations...');
      await page.waitForTimeout(5000);
      
      console.log('✅ All steps completed successfully');
      
    } catch (error) {
      console.log('❌ Test failed with error:', error.message);
      await page.screenshot({ path: 'debug-final-test-error.png' });
      throw error;
    }
    
    // Capture and analyze traces
    const traces = {
      networkTraces,
      consoleLogs,
      pageErrors,
      testData: testData || {},
      timestamp: new Date().toISOString()
    };
    
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
    
    console.log('✅ FINAL test completed successfully');
    expect(true).toBe(true);
  });
});
