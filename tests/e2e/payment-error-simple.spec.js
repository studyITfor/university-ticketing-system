// tests/e2e/payment-error-simple.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Payment Error Handling - Simple Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
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

  test('should handle network errors during payment confirmation', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Mock a network failure for the payment confirmation
    await page.route('**/api/create-booking', route => {
      route.abort('failed');
    });
    
    // Set up booking data and trigger payment confirmation
    await page.evaluate(() => {
      if (window.studentSystem) {
        window.studentSystem.tempBookingData = {
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
          whatsappOptin: true
        };
        window.studentSystem.currentBookingSeat = '1-1';
        window.studentSystem.handlePaymentConfirmation();
      }
    });
    
    // Wait a moment for the error to be handled
    await page.waitForTimeout(3000);
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
    
    // Check that error message is displayed
    const errorElement = page.locator('#paymentError');
    await expect(errorElement).toBeVisible();
    
    // Check that error message contains expected text
    await expect(errorElement.locator('.error-message')).toContainText('Ошибка при подтверждении оплаты');
  });

  test('should allow retry after payment error', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Mock a network failure for the payment confirmation
    await page.route('**/api/create-booking', route => {
      route.abort('failed');
    });
    
    // Set up booking data and trigger payment confirmation
    await page.evaluate(() => {
      if (window.studentSystem) {
        window.studentSystem.tempBookingData = {
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
          whatsappOptin: true
        };
        window.studentSystem.currentBookingSeat = '1-1';
        window.studentSystem.handlePaymentConfirmation();
      }
    });
    
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
});
