// tests/e2e/diagnostic-whatsapp-integration.spec.js
const { test, expect } = require('@playwright/test');

test.describe('WhatsApp Integration Diagnostic Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for all network requests and responses
    const requests = [];
    const responses = [];
    const errors = [];

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
          headers: response.headers()
        });
      }
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', error => {
      errors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack
      });
    });

    // Store in page context for later access
    await page.evaluate(({ reqs, resps, errs }) => {
      window.diagnosticData = { requests: reqs, responses: resps, errors: errs };
    }, { reqs: requests, resps: responses, errs: errors });

    await page.goto('http://localhost:3000');
  });

  test('should handle WhatsApp opt-in without Internal Server Error', async ({ page }) => {
    console.log('🔍 Starting WhatsApp opt-in diagnostic test...');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Select a table
    await page.click('.table-area[data-table-id="1"]');
    console.log('✅ Table selected');

    // Fill out the booking form
    await page.fill('#firstName', 'Diagnostic');
    await page.fill('#lastName', 'Test');
    await page.fill('#phone', '+996555245629');
    await page.check('#whatsappOptin');
    console.log('✅ Form filled');

    // Click the book button
    await page.click('#bookButton');
    console.log('✅ Book button clicked');

    // Wait for the booking modal
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    console.log('✅ Booking modal appeared');

    // Fill out the modal form
    await page.fill('#modalFirstName', 'Diagnostic');
    await page.fill('#modalLastName', 'Test');
    await page.fill('#modalPhone', '+996555245629');
    await page.check('#modalWhatsappOptin');
    console.log('✅ Modal form filled');

    // Click confirm booking
    await page.click('#confirmBooking');
    console.log('✅ Confirm booking clicked');

    // Wait for the payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    console.log('✅ Payment modal appeared');

    // Click "I paid" button
    await page.click('#confirmPayment');
    console.log('✅ Confirm payment clicked');

    // Wait for the confirmation modal
    await page.waitForSelector('#confirmationModal', { state: 'visible' });
    console.log('✅ Confirmation modal appeared');

    // Check for any errors
    const diagnosticData = await page.evaluate(() => window.diagnosticData);
    
    console.log('📊 Diagnostic Data:');
    console.log('Requests:', diagnosticData.requests);
    console.log('Responses:', diagnosticData.responses);
    console.log('Errors:', diagnosticData.errors);

    // Verify no Internal Server Error occurred
    const hasInternalServerError = diagnosticData.responses.some(resp => resp.status >= 500);
    expect(hasInternalServerError).toBe(false);

    // Verify all API responses are JSON
    const nonJsonResponses = diagnosticData.responses.filter(resp => 
      resp.status >= 200 && resp.status < 300 && 
      !resp.headers['content-type']?.includes('application/json')
    );
    expect(nonJsonResponses).toHaveLength(0);

    // Verify no page errors
    const pageErrors = diagnosticData.errors.filter(err => err.type === 'pageerror');
    expect(pageErrors).toHaveLength(0);

    console.log('✅ All diagnostic checks passed');
  });

  test('should handle invalid phone format gracefully', async ({ page }) => {
    console.log('🔍 Testing invalid phone format handling...');

    await page.waitForLoadState('networkidle');

    // Select a table
    await page.click('.table-area[data-table-id="1"]');

    // Fill out the booking form with invalid phone
    await page.fill('#firstName', 'Diagnostic');
    await page.fill('#lastName', 'Test');
    await page.fill('#phone', '996555245629'); // Missing + prefix
    await page.check('#whatsappOptin');

    // Click the book button
    await page.click('#bookButton');

    // Wait for the booking modal
    await page.waitForSelector('#bookingModal', { state: 'visible' });

    // Fill out the modal form with invalid phone
    await page.fill('#modalFirstName', 'Diagnostic');
    await page.fill('#modalLastName', 'Test');
    await page.fill('#modalPhone', '996555245629'); // Missing + prefix
    await page.check('#modalWhatsappOptin');

    // Click confirm booking
    await page.click('#confirmBooking');

    // Should show validation error
    await expect(page.locator('text=Invalid phone format')).toBeVisible();
    console.log('✅ Invalid phone format handled correctly');
  });

  test('should handle missing required fields gracefully', async ({ page }) => {
    console.log('🔍 Testing missing required fields handling...');

    await page.waitForLoadState('networkidle');

    // Select a table
    await page.click('.table-area[data-table-id="1"]');

    // Fill out the booking form with missing fields
    await page.fill('#firstName', 'Diagnostic');
    // Missing lastName and phone
    await page.check('#whatsappOptin');

    // Click the book button
    await page.click('#bookButton');

    // Wait for the booking modal
    await page.waitForSelector('#bookingModal', { state: 'visible' });

    // Fill out the modal form with missing fields
    await page.fill('#modalFirstName', 'Diagnostic');
    // Missing lastName and phone

    // Click confirm booking
    await page.click('#confirmBooking');

    // Should show validation error
    await expect(page.locator('text=required')).toBeVisible();
    console.log('✅ Missing required fields handled correctly');
  });
});
