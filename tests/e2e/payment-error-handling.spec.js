// tests/e2e/payment-error-handling.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Payment Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should handle payment confirmation errors gracefully', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for the image to load and table areas to be generated
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
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '+1234567890');
    await page.check('#whatsappOptin');
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Mock a network failure for the payment confirmation
    await page.route('**/api/create-booking', route => {
      route.abort('failed');
    });
    
    // Click confirm payment
    await page.click('#confirmPayment');
    
    // Wait a moment for the error to be handled
    await page.waitForTimeout(3000);
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
    
    // Check that error message is displayed
    const errorElement = page.locator('#paymentError');
    await expect(errorElement).toBeVisible();
    
    // Check that error message contains expected text
    await expect(errorElement.locator('.error-message')).toContainText('Ошибка при подтверждении оплаты');
    
    // Check that retry button is present
    await expect(errorElement.locator('.retry-btn')).toBeVisible();
  });

  test('should handle missing booking data gracefully', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Directly trigger payment confirmation without booking data
    await page.evaluate(() => {
      if (window.studentSystem) {
        window.studentSystem.tempBookingData = null;
        window.studentSystem.currentBookingSeat = null;
        window.studentSystem.handlePaymentConfirmation();
      }
    });
    
    // Wait a moment for the error to be handled
    await page.waitForTimeout(2000);
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
    
    // Check that error message is displayed
    const errorElement = page.locator('#paymentError');
    await expect(errorElement).toBeVisible();
    
    // Check that error message contains expected text
    await expect(errorElement.locator('.error-message')).toContainText('Нет данных для подтверждения оплаты');
  });

  test('should allow retry after payment error', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for the image to load and table areas to be generated
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
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '+1234567890');
    await page.check('#whatsappOptin');
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Mock a network failure for the payment confirmation
    await page.route('**/api/create-booking', route => {
      route.abort('failed');
    });
    
    // Click confirm payment
    await page.click('#confirmPayment');
    
    // Wait for error message
    await page.waitForSelector('#paymentError', { state: 'visible' });
    
    // Restore the network
    await page.unroute('**/api/create-booking');
    
    // Click retry button
    await page.click('#paymentError .retry-btn');
    
    // Wait a moment for retry to process
    await page.waitForTimeout(3000);
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
    
    // Error should be hidden after retry
    const errorElement = page.locator('#paymentError');
    await expect(errorElement).not.toBeVisible();
  });

  test('should auto-hide error message after timeout', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Directly trigger payment confirmation without booking data
    await page.evaluate(() => {
      if (window.studentSystem) {
        window.studentSystem.tempBookingData = null;
        window.studentSystem.currentBookingSeat = null;
        window.studentSystem.handlePaymentConfirmation();
      }
    });
    
    // Wait for error message to appear
    await page.waitForSelector('#paymentError', { state: 'visible' });
    
    // Wait for auto-hide timeout (10 seconds)
    await page.waitForTimeout(11000);
    
    // Check that error message is hidden
    const errorElement = page.locator('#paymentError');
    await expect(errorElement).not.toBeVisible();
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
  });

  test('should handle setTextSafe with null elements', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Test setTextSafe function with non-existent element
    await page.evaluate(() => {
      if (window.setTextSafe) {
        const result = window.setTextSafe('#non-existent-element', 'Test message');
        console.log('setTextSafe result:', result);
      }
    });
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
  });
});

