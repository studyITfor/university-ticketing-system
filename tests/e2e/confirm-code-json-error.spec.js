// tests/e2e/confirm-code-json-error.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Confirm Code JSON Error Fix', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
    
    // Store page errors for later assertion
    page.pageErrors = pageErrors;
  });

  test('should handle booking creation with proper JSON response', async ({ page }) => {
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
    
    // Monitor network requests
    const requests = [];
    const responses = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          contentType: response.headers()['content-type']
        });
      }
    });
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Verify that the booking request was made with proper headers
    const bookingRequest = requests.find(r => r.url.includes('/api/create-booking'));
    expect(bookingRequest).toBeTruthy();
    expect(bookingRequest.headers['content-type']).toBe('application/json');
    expect(bookingRequest.headers['accept']).toBe('application/json');
    
    // Verify that the response was JSON
    const bookingResponse = responses.find(r => r.url.includes('/api/create-booking'));
    expect(bookingResponse).toBeTruthy();
    expect(bookingResponse.contentType).toContain('application/json');
    expect(bookingResponse.status).toBe(200);
    
    // Verify no page errors occurred
    expect(page.pageErrors).toHaveLength(0);
    
    console.log('✅ Booking creation returned proper JSON response');
  });

  test('should handle confirmation code sending with proper error handling', async ({ page }) => {
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
    
    // Monitor network requests
    const responses = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/optin')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          contentType: response.headers()['content-type']
        });
      }
    });
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for confirmation code modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Verify that the opt-in request was made and returned JSON
    const optinResponse = responses.find(r => r.url.includes('/api/optin'));
    expect(optinResponse).toBeTruthy();
    expect(optinResponse.contentType).toContain('application/json');
    
    // The response might be 500 due to WhatsApp service not being configured,
    // but it should still be JSON
    expect([200, 500]).toContain(optinResponse.status);
    
    // Verify no page errors occurred
    expect(page.pageErrors).toHaveLength(0);
    
    console.log('✅ Confirmation code request returned proper JSON response');
  });

  test('should handle non-JSON responses gracefully', async ({ page }) => {
    // Mock a non-JSON response for booking creation
    await page.route('**/api/create-booking', route => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><body>Error page</body></html>',
      });
    });

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
    await page.fill('#firstName', `Test${timestamp}`);
    await page.fill('#lastName', `User${timestamp}`);
    await page.fill('#phone', `+1234567${timestamp.toString().slice(-4)}`);
    await page.check('#whatsappOptin');
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Should show error message instead of crashing
    await page.waitForFunction(() => {
      const errorElement = document.querySelector('.alert-error, #paymentError');
      return errorElement && errorElement.textContent.includes('unexpected response');
    }, { timeout: 5000 });
    
    // Verify no page errors occurred (setTextSafe should prevent them)
    expect(page.pageErrors).toHaveLength(0);
    
    console.log('✅ Non-JSON response handled gracefully');
  });

  test('should handle WhatsApp service errors with proper JSON', async ({ page }) => {
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
    
    // Monitor network requests
    const responses = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/optin')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          contentType: response.headers()['content-type']
        });
      }
    });
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for confirmation code modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Verify that the opt-in request returned JSON even on error
    const optinResponse = responses.find(r => r.url.includes('/api/optin'));
    expect(optinResponse).toBeTruthy();
    expect(optinResponse.contentType).toContain('application/json');
    
    // Should be 500 due to WhatsApp service not configured, but still JSON
    expect(optinResponse.status).toBe(500);
    
    // Verify no page errors occurred
    expect(page.pageErrors).toHaveLength(0);
    
    console.log('✅ WhatsApp service error returned proper JSON response');
  });
});
