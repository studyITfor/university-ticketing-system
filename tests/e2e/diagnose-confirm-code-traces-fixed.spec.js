// tests/e2e/diagnose-confirm-code-traces-fixed.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Diagnose Confirm Code Internal Error - Fixed Version', () => {
  test('capture complete traces for confirm code error', async ({ page }) => {
    // Set explicit test timeout
    test.setTimeout(60000); // 60 seconds total timeout
    
    console.log('🚀 Starting diagnostic test...');
    
    // Capture all network requests and responses
    const networkTraces = [];
    const consoleLogs = [];
    const pageErrors = [];
    
    // Capture network requests
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
    
    // Capture network responses
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        console.log(`📡 Response: ${response.status()} ${response.url()}`);
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
      console.log(`📝 Console [${msg.type()}]: ${msg.text()}`);
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      console.log(`❌ Page Error: ${error.message}`);
      pageErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    try {
      console.log('🌐 Navigating to http://localhost:3000...');
      // Navigate to the booking page with timeout
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      console.log('⏳ Waiting for network idle...');
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      
      console.log('🔍 Looking for interactive seating plan...');
      // Wait for the seating plan to load with explicit timeout
      try {
        await page.waitForSelector('#interactiveSeatingPlan', { 
          state: 'visible',
          timeout: 10000 
        });
        console.log('✅ Interactive seating plan found');
      } catch (error) {
        console.log('❌ Interactive seating plan not found:', error.message);
        // Continue anyway - maybe the element has a different selector
      }
      
      console.log('🔍 Looking for table areas...');
      // Wait for table areas to be generated with explicit timeout
      try {
        await page.waitForFunction(() => {
          const tableAreas = document.querySelectorAll('.table-area');
          return tableAreas.length > 0;
        }, { timeout: 15000 });
        console.log('✅ Table areas found');
      } catch (error) {
        console.log('❌ Table areas not found:', error.message);
        // Try alternative selectors
        const alternativeSelectors = [
          '.seat',
          '.table',
          '[data-table]',
          '[data-seat]'
        ];
        
        let found = false;
        for (const selector of alternativeSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            console.log(`✅ Found alternative selector: ${selector}`);
            found = true;
            break;
          } catch (e) {
            console.log(`❌ Alternative selector ${selector} not found`);
          }
        }
        
        if (!found) {
          console.log('❌ No table/seat elements found at all');
          // Take a screenshot for debugging
          await page.screenshot({ path: 'debug-no-tables.png' });
          throw new Error('No table/seat elements found');
        }
      }
      
      console.log('🖱️ Looking for clickable table area...');
      // Try to find and click an available table area
      let clicked = false;
      const clickableSelectors = [
        '.table-area:not(.booked)',
        '.table-area:not(.selected)',
        '.table-area',
        '.seat:not(.booked)',
        '.seat:not(.selected)',
        '.seat'
      ];
      
      for (const selector of clickableSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            console.log(`🖱️ Clicking on ${selector}...`);
            await element.click({ timeout: 5000 });
            clicked = true;
            break;
          }
        } catch (error) {
          console.log(`❌ Failed to click ${selector}:`, error.message);
        }
      }
      
      if (!clicked) {
        console.log('❌ No clickable table areas found');
        await page.screenshot({ path: 'debug-no-clickable.png' });
        throw new Error('No clickable table areas found');
      }
      
      console.log('⏳ Waiting for booking modal...');
      // Wait for booking modal with timeout
      try {
        await page.waitForSelector('#bookingModal', { 
          state: 'visible',
          timeout: 10000 
        });
        console.log('✅ Booking modal found');
      } catch (error) {
        console.log('❌ Booking modal not found:', error.message);
        // Try alternative selectors
        const modalSelectors = [
          '.modal',
          '[role="dialog"]',
          '.booking-form',
          '#bookingForm'
        ];
        
        let modalFound = false;
        for (const selector of modalSelectors) {
          try {
            await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
            console.log(`✅ Found modal with selector: ${selector}`);
            modalFound = true;
            break;
          } catch (e) {
            console.log(`❌ Modal selector ${selector} not found`);
          }
        }
        
        if (!modalFound) {
          await page.screenshot({ path: 'debug-no-modal.png' });
          throw new Error('No booking modal found');
        }
      }
      
      console.log('📝 Filling out booking form...');
      // Fill out the booking form
      const timestamp = Date.now();
      const testData = {
        firstName: `Test${timestamp}`,
        lastName: `User${timestamp}`,
        phone: `+1234567${timestamp.toString().slice(-4)}`
      };
      
      // Try to fill form fields with error handling
      const formFields = [
        { selector: '#firstName', value: testData.firstName },
        { selector: '#lastName', value: testData.lastName },
        { selector: '#phone', value: testData.phone }
      ];
      
      for (const field of formFields) {
        try {
          await page.fill(field.selector, field.value, { timeout: 5000 });
          console.log(`✅ Filled ${field.selector}`);
        } catch (error) {
          console.log(`❌ Failed to fill ${field.selector}:`, error.message);
        }
      }
      
      // Try to check WhatsApp opt-in
      try {
        await page.check('#whatsappOptin', { timeout: 5000 });
        console.log('✅ Checked WhatsApp opt-in');
      } catch (error) {
        console.log('❌ Failed to check WhatsApp opt-in:', error.message);
      }
      
      console.log('🚀 Submitting booking form...');
      // Submit the booking form
      try {
        await page.click('#bookingForm button[type="submit"]', { timeout: 5000 });
        console.log('✅ Form submitted');
      } catch (error) {
        console.log('❌ Failed to submit form:', error.message);
        // Try alternative submit buttons
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          '.submit-btn',
          '.btn-submit',
          'button:has-text("Book")',
          'button:has-text("Submit")'
        ];
        
        let submitted = false;
        for (const selector of submitSelectors) {
          try {
            await page.click(selector, { timeout: 3000 });
            console.log(`✅ Submitted with selector: ${selector}`);
            submitted = true;
            break;
          } catch (e) {
            console.log(`❌ Submit selector ${selector} failed`);
          }
        }
        
        if (!submitted) {
          throw new Error('Could not submit form');
        }
      }
      
      console.log('⏳ Waiting for confirmation code modal...');
      // Wait for confirmation code modal with timeout
      try {
        await page.waitForSelector('#confirmationCodeModal', { 
          state: 'visible',
          timeout: 15000 
        });
        console.log('✅ Confirmation code modal found');
      } catch (error) {
        console.log('❌ Confirmation code modal not found:', error.message);
        // Try alternative modal selectors
        const modalSelectors = [
          '.confirmation-modal',
          '.code-modal',
          '[role="dialog"]',
          '.modal'
        ];
        
        let modalFound = false;
        for (const selector of modalSelectors) {
          try {
            await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
            console.log(`✅ Found confirmation modal with selector: ${selector}`);
            modalFound = true;
            break;
          } catch (e) {
            console.log(`❌ Confirmation modal selector ${selector} not found`);
          }
        }
        
        if (!modalFound) {
          console.log('⚠️ No confirmation modal found - this might be the issue');
        }
      }
      
      console.log('⏳ Waiting for async operations to complete...');
      // Wait a moment for any async operations
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.log('❌ Test error:', error.message);
      await page.screenshot({ path: 'debug-test-error.png' });
      throw error;
    }
    
    // Capture all traces
    const traces = {
      networkTraces,
      consoleLogs,
      pageErrors,
      testData: testData || {},
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
    console.log('✅ Test completed successfully');
    expect(true).toBe(true);
  });
});
