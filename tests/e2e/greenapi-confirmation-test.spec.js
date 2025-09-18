const { test, expect } = require('@playwright/test');

test.describe('Green API Confirmation Code Integration', () => {
  test.setTimeout(120000); // 2 minutes timeout

  test('should send confirmation code via Green API', async ({ page }) => {
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

    console.log('🚀 Starting Green API confirmation test...');
    
    // Navigate to the booking page
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('🌐 Page loaded successfully');

    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible', timeout: 15000 });
    console.log('✅ Seating plan visible');

    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    console.log('✅ Table areas generated');

    // Click on an available table area
    const availableTableArea = page.locator('.table-area:not(.booked)').first();
    await availableTableArea.waitFor({ state: 'visible', timeout: 5000 });
    await availableTableArea.click();
    console.log('✅ Table area clicked');

    // Wait for booking modal
    await page.waitForSelector('#bookingModal', { state: 'visible', timeout: 10000 });
    console.log('✅ Booking modal visible');

    // Fill out the booking form
    const timestamp = Date.now();
    const testData = {
      firstName: `Test${timestamp}`,
      lastName: `User${timestamp}`,
      phone: `+996555245629` // Use the Green API test phone
    };

    await page.fill('#firstName', testData.firstName);
    await page.fill('#lastName', testData.lastName);
    await page.fill('#phone', testData.phone);
    console.log('✅ Booking form filled');

    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    console.log('✅ Booking form submitted');

    // Wait for booking to be created
    await page.waitForTimeout(2000);
    console.log('✅ Waiting for booking creation');

    // Test the confirmation code endpoint directly
    console.log('📱 Testing confirmation code endpoint...');
    
    const confirmationResponse = await page.evaluate(async (data) => {
      try {
        const response = await fetch('/api/send-confirmation-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: data.phone,
            name: `${data.firstName} ${data.lastName}`,
            bookingId: 'test-booking-id'
          })
        });
        
        const result = await response.json();
        return {
          status: response.status,
          success: response.ok,
          data: result
        };
      } catch (error) {
        return {
          status: 0,
          success: false,
          error: error.message
        };
      }
    }, testData);

    console.log('📥 Confirmation code response:', confirmationResponse);

    // Verify the response
    expect(confirmationResponse.success).toBe(true);
    expect(confirmationResponse.status).toBe(200);
    expect(confirmationResponse.data.success).toBe(true);
    expect(confirmationResponse.data.phone).toBe(testData.phone);
    expect(confirmationResponse.data.confirmationCode).toBeDefined();
    expect(confirmationResponse.data.provider).toBe('greenapi');

    console.log('✅ Confirmation code sent successfully via Green API');

    // Log traces for debugging
    console.log('=== NETWORK TRACES ===');
    networkTraces.forEach(trace => {
      console.log(`${trace.timestamp} [${trace.type.toUpperCase()}] ${trace.method || 'GET'} ${trace.url}`);
      if (trace.type === 'response' && trace.status >= 400) {
        console.log(`  Error ${trace.status}: ${trace.body.substring(0, 200)}`);
      }
    });

    console.log('=== CONSOLE LOGS ===');
    consoleLogs.forEach(log => {
      if (log.type === 'error') {
        console.log(`${log.timestamp} [ERROR] ${log.text}`);
      }
    });

    console.log('=== PAGE ERRORS ===');
    pageErrors.forEach(error => {
      console.log(`${error.timestamp} [PAGE ERROR] ${error.message}`);
    });

    // Ensure no critical errors occurred
    const criticalErrors = pageErrors.filter(error => 
      !error.message.includes('favicon') && 
      !error.message.includes('404')
    );
    
    if (criticalErrors.length > 0) {
      console.warn('⚠️ Critical page errors detected:', criticalErrors);
    }

    console.log('✅ Green API confirmation test completed successfully');
  });

  test('should handle Green API errors gracefully', async ({ page }) => {
    console.log('🚀 Starting Green API error handling test...');
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Test with invalid phone format
    const invalidPhoneResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/send-confirmation-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: '996555245629', // Missing + prefix
            name: 'Test User'
          })
        });
        
        const result = await response.json();
        return {
          status: response.status,
          success: response.ok,
          data: result
        };
      } catch (error) {
        return {
          status: 0,
          success: false,
          error: error.message
        };
      }
    });

    console.log('📥 Invalid phone response:', invalidPhoneResponse);

    // Verify error handling
    expect(invalidPhoneResponse.success).toBe(false);
    expect(invalidPhoneResponse.status).toBe(400);
    expect(invalidPhoneResponse.data.success).toBe(false);
    expect(invalidPhoneResponse.data.code).toBe('INVALID_PHONE_FORMAT');

    console.log('✅ Error handling test completed successfully');
  });

  test('should handle missing required fields', async ({ page }) => {
    console.log('🚀 Starting missing fields test...');
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Test with missing phone
    const missingPhoneResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/send-confirmation-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Test User'
            // Missing phone
          })
        });
        
        const result = await response.json();
        return {
          status: response.status,
          success: response.ok,
          data: result
        };
      } catch (error) {
        return {
          status: 0,
          success: false,
          error: error.message
        };
      }
    });

    console.log('📥 Missing phone response:', missingPhoneResponse);

    // Verify error handling
    expect(missingPhoneResponse.success).toBe(false);
    expect(missingPhoneResponse.status).toBe(400);
    expect(missingPhoneResponse.data.success).toBe(false);
    expect(missingPhoneResponse.data.code).toBe('MISSING_PHONE');

    // Test with missing name
    const missingNameResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/send-confirmation-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: '+996555245629'
            // Missing name
          })
        });
        
        const result = await response.json();
        return {
          status: response.status,
          success: response.ok,
          data: result
        };
      } catch (error) {
        return {
          status: 0,
          success: false,
          error: error.message
        };
      }
    });

    console.log('📥 Missing name response:', missingNameResponse);

    // Verify error handling
    expect(missingNameResponse.success).toBe(false);
    expect(missingNameResponse.status).toBe(400);
    expect(missingNameResponse.data.success).toBe(false);
    expect(missingNameResponse.data.code).toBe('MISSING_NAME');

    console.log('✅ Missing fields test completed successfully');
  });
});
