// tests/e2e/student-pay-flow.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Student Pay Flow - Complete Booking Workflow', () => {
  let bookingId;
  let tableNumber = 1;
  let seatNumber = 1;
  let seatId = `${tableNumber}-${seatNumber}`;

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

  test('should complete full student booking flow: Book -> I Paid -> Awaiting Confirmation', async ({ page }) => {
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
    
    // Fill out the booking form with unique data
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
    
    // Submit the booking form (this should create booking with 'selected' status)
    await page.click('#bookingForm button[type="submit"]');
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Verify payment modal shows correct amount
    await expect(page.locator('#paymentAmount')).toContainText('5,500 Сом');
    
    // Click "I paid" button (this should call mark-paid endpoint)
    await page.click('#confirmPayment');
    
    // Wait for confirmation modal
    await page.waitForSelector('#confirmationModal', { state: 'visible' });
    
    // Verify confirmation modal shows correct message
    await expect(page.locator('#confirmationModal .modal-body p')).toContainText('ожидает подтверждения администратора');
    
    // Verify booking ID is displayed
    const bookingIdElement = page.locator('#confirmedBookingId');
    await expect(bookingIdElement).toBeVisible();
    
    // Extract booking ID for later use
    const bookingIdText = await bookingIdElement.textContent();
    bookingId = bookingIdText.match(/ID бронирования: (.+)/)?.[1];
    expect(bookingId).toBeTruthy();
    
    // Verify no page errors occurred
    expect(page.pageErrors).toHaveLength(0);
    
    console.log(`✅ Booking created with ID: ${bookingId}`);
  });

  test('should handle payment confirmation errors gracefully', async ({ page }) => {
    // Mock a failed mark-paid request
    await page.route('**/api/book/mark-paid', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Simulated payment failure' }),
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
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Click "I paid" button (this should fail)
    await page.click('#confirmPayment');
    
    // Wait for error message to appear
    await page.waitForSelector('#paymentError', { state: 'visible' });
    
    // Verify error message is displayed
    await expect(page.locator('#paymentError')).toContainText('Ошибка при подтверждении оплаты');
    
    // Verify retry button is visible
    await expect(page.locator('#paymentError .retry-btn')).toBeVisible();
    
    // Verify no page errors occurred (setTextSafe should prevent them)
    expect(page.pageErrors).toHaveLength(0);
  });

  test('should prevent duplicate payment confirmations', async ({ page }) => {
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
    
    // Wait for payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
    
    // Click "I paid" button multiple times rapidly
    await page.click('#confirmPayment');
    await page.click('#confirmPayment');
    await page.click('#confirmPayment');
    
    // Should only process once (idempotent)
    // Wait for confirmation modal
    await page.waitForSelector('#confirmationModal', { state: 'visible' });
    
    // Verify confirmation modal appears only once
    const confirmationModals = await page.locator('#confirmationModal').count();
    expect(confirmationModals).toBe(1);
    
    // Verify no page errors occurred
    expect(page.pageErrors).toHaveLength(0);
  });

  test('should validate required fields before allowing payment', async ({ page }) => {
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
    
    // Try to submit form with empty fields
    await page.click('#bookingForm button[type="submit"]');
    
    // Form should not proceed to payment modal with empty fields
    const paymentModal = page.locator('#paymentModal');
    await expect(paymentModal).not.toBeVisible();
    
    // Fill only some fields
    await page.fill('#firstName', 'Test');
    await page.click('#bookingForm button[type="submit"]');
    
    // Still should not proceed
    await expect(paymentModal).not.toBeVisible();
    
    // Fill all required fields
    await page.fill('#lastName', 'User');
    await page.fill('#phone', '+1234567890');
    await page.click('#bookingForm button[type="submit"]');
    
    // Now should proceed to payment modal
    await page.waitForSelector('#paymentModal', { state: 'visible' });
  });

  test('should handle network errors during booking creation', async ({ page }) => {
    // Mock a failed booking creation request
    await page.route('**/api/book', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Database connection failed' }),
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
    
    // Submit the booking form (this should fail)
    await page.click('#bookingForm button[type="submit"]');
    
    // Should show error alert
    await page.waitForFunction(() => {
      return window.alert.called || document.querySelector('.alert-error');
    }, { timeout: 5000 });
    
    // Verify no page errors occurred
    expect(page.pageErrors).toHaveLength(0);
  });
});
