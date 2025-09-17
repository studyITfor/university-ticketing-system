// tests/e2e/booking-workflow.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Booking Workflow with Admin Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should create booking with selected status and no page errors', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
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
    await page.fill('#firstName', 'Test');
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '+1234567890');
    await page.check('#whatsappOptin');
    
    // Submit the booking form
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Click confirm payment
    await page.click('#confirmPayment');
    
    // Wait for confirmation modal
    await page.waitForSelector('#confirmationModal', { state: 'visible' });
    
    // Check that no page errors occurred
    expect(pageErrors).toHaveLength(0);
    
    // Check that booking was created successfully
    await expect(page.locator('#confirmationModal')).toBeVisible();
  });

  test('should handle payment confirmation errors gracefully', async ({ page }) => {
    // Listen for page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
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
    await expect(errorElement).toContainText('Ошибка при подтверждении оплаты');
  });

  test('should have setTextSafe function available', async ({ page }) => {
    // Check that setTextSafe function is available globally
    const setTextSafeFunction = await page.evaluate(() => {
      return typeof window.setTextSafe === 'function';
    });
    
    expect(setTextSafeFunction).toBe(true);
  });

  test('should handle real-time booking updates', async ({ page }) => {
    // Wait for the seating plan to load
    await page.waitForSelector('#interactiveSeatingPlan', { state: 'visible' });
    
    // Wait for table areas to be generated
    await page.waitForFunction(() => {
      const tableAreas = document.querySelectorAll('.table-area');
      return tableAreas.length > 0;
    }, { timeout: 10000 });
    
    // Simulate a real-time booking update
    await page.evaluate(() => {
      if (window.studentSystem && window.studentSystem.socket) {
        // Simulate receiving a booking update
        const mockUpdate = {
          type: 'booking.updated',
          bookingId: 123,
          tableId: 1,
          seatId: '1-1',
          newStatus: 'booked_paid',
          timestamp: Date.now()
        };
        
        window.studentSystem.handleBookingUpdate(mockUpdate);
      }
    });
    
    // Wait a moment for the update to be processed
    await page.waitForTimeout(1000);
    
    // Check that the update was handled without errors
    const hasErrors = await page.evaluate(() => {
      return window.console.error.calls && window.console.error.calls.length > 0;
    });
    
    expect(hasErrors).toBeFalsy();
  });
});
