// tests/e2e/green-api-integration.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Green API WhatsApp Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should handle WhatsApp opt-in with Green API', async ({ page }) => {
    // Listen for network requests
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/optin')) {
        requests.push(request);
      }
    });

    // Fill out the booking form
    await page.click('.table-area[data-table-id="1"]');
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '+996555245629');
    await page.check('#whatsappOptin');

    // Click the book button
    await page.click('#bookButton');

    // Wait for the booking modal to appear
    await page.waitForSelector('#bookingModal', { state: 'visible' });

    // Fill out the booking form in the modal
    await page.fill('#modalFirstName', 'Test');
    await page.fill('#modalLastName', 'User');
    await page.fill('#modalPhone', '+996555245629');
    await page.check('#modalWhatsappOptin');

    // Click confirm booking
    await page.click('#confirmBooking');

    // Wait for the payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });

    // Click "I paid" button
    await page.click('#confirmPayment');

    // Wait for the confirmation modal
    await page.waitForSelector('#confirmationModal', { state: 'visible' });

    // Verify the confirmation modal shows success
    await expect(page.locator('#confirmationModal')).toBeVisible();
    await expect(page.locator('text=Бронирование подтверждено')).toBeVisible();

    // Verify no confirmation code modal appears
    await expect(page.locator('#confirmationCodeModal')).not.toBeVisible();
  });

  test('should handle invalid phone format gracefully', async ({ page }) => {
    // Fill out the booking form with invalid phone
    await page.click('.table-area[data-table-id="1"]');
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '996555245629'); // Missing + prefix
    await page.check('#whatsappOptin');

    // Click the book button
    await page.click('#bookButton');

    // Wait for the booking modal to appear
    await page.waitForSelector('#bookingModal', { state: 'visible' });

    // Fill out the booking form in the modal
    await page.fill('#modalFirstName', 'Test');
    await page.fill('#modalLastName', 'User');
    await page.fill('#modalPhone', '996555245629'); // Missing + prefix
    await page.check('#modalWhatsappOptin');

    // Click confirm booking
    await page.click('#confirmBooking');

    // Should show validation error
    await expect(page.locator('text=Invalid phone format')).toBeVisible();
  });

  test('should handle Green API errors gracefully', async ({ page }) => {
    // Mock the API to return an error
    await page.route('**/api/optin', async route => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'WhatsApp service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE'
        })
      });
    });

    // Fill out the booking form
    await page.click('.table-area[data-table-id="1"]');
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '+996555245629');
    await page.check('#whatsappOptin');

    // Click the book button
    await page.click('#bookButton');

    // Wait for the booking modal to appear
    await page.waitForSelector('#bookingModal', { state: 'visible' });

    // Fill out the booking form in the modal
    await page.fill('#modalFirstName', 'Test');
    await page.fill('#modalLastName', 'User');
    await page.fill('#modalPhone', '+996555245629');
    await page.check('#modalWhatsappOptin');

    // Click confirm booking
    await page.click('#confirmBooking');

    // Should show error message
    await expect(page.locator('text=WhatsApp service temporarily unavailable')).toBeVisible();
  });
});
