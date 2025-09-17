// Test user payment confirmation flow with Playwright
const { test, expect } = require('@playwright/test');

test.describe('User Payment Confirmation Flow', () => {
    test('Complete user payment flow on desktop', async ({ page }) => {
        // Navigate to the student page
        await page.goto('http://localhost:3000/frontend/index.html');
        
        // Wait for the page to load
        await page.waitForLoadState('networkidle');
        
        // Take initial screenshot
        await page.screenshot({ path: 'test-results/01-initial-page.png' });
        
        // Click on a seat (Table 1, Seat 13)
        const seat = page.locator('[data-table="1"][data-seat="13"]');
        await expect(seat).toBeVisible();
        await seat.click();
        
        // Wait for booking modal to appear
        await page.waitForSelector('#bookingModal', { state: 'visible' });
        await page.screenshot({ path: 'test-results/02-booking-modal.png' });
        
        // Fill in the booking form
        await page.fill('#studentName', 'Playwright Test User');
        await page.fill('#phone', '+996555123468');
        await page.fill('#email', 'playwright@example.com');
        await page.fill('#whatsapp', '+996555123468');
        await page.selectOption('#paymentMethod', 'card');
        
        // Submit the form
        await page.click('#bookingForm button[type="submit"]');
        
        // Wait for payment modal to appear
        await page.waitForSelector('#paymentModal', { state: 'visible' });
        await page.screenshot({ path: 'test-results/03-payment-modal.png' });
        
        // Click "Я оплатил" button
        const confirmButton = page.locator('#confirmPayment');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();
        
        // Wait for loading state
        await expect(confirmButton).toContainText('Обработка...');
        
        // Wait for confirmation modal
        await page.waitForSelector('#confirmationModal', { state: 'visible' });
        await page.screenshot({ path: 'test-results/04-confirmation-modal.png' });
        
        // Check that the confirmation message shows payment confirmed
        const confirmationMessage = page.locator('#confirmationModal .modal-body p');
        await expect(confirmationMessage).toContainText('Оплата подтверждена');
        await expect(confirmationMessage).toContainText('Билет отправлен в WhatsApp');
        
        // Check that the seat is now marked as paid (red)
        const seatElement = page.locator('[data-table="1"][data-seat="13"]');
        await expect(seatElement).toHaveClass(/paid/);
        
        // Check seat color (should be red for paid)
        const seatStyle = await seatElement.evaluate(el => {
            return {
                backgroundColor: el.style.backgroundColor,
                borderColor: el.style.borderColor
            };
        });
        
        console.log('Seat style after payment:', seatStyle);
        
        // Close confirmation modal
        await page.click('#confirmationModal .close');
        
        // Take final screenshot
        await page.screenshot({ path: 'test-results/05-final-state.png' });
    });
    
    test('Complete user payment flow on mobile', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        // Navigate to the student page
        await page.goto('http://localhost:3000/frontend/index.html');
        
        // Wait for the page to load
        await page.waitForLoadState('networkidle');
        
        // Take initial mobile screenshot
        await page.screenshot({ path: 'test-results/mobile-01-initial-page.png' });
        
        // Click on a seat (Table 1, Seat 14)
        const seat = page.locator('[data-table="1"][data-seat="14"]');
        await expect(seat).toBeVisible();
        await seat.click();
        
        // Wait for booking modal to appear
        await page.waitForSelector('#bookingModal', { state: 'visible' });
        await page.screenshot({ path: 'test-results/mobile-02-booking-modal.png' });
        
        // Fill in the booking form
        await page.fill('#studentName', 'Mobile Test User');
        await page.fill('#phone', '+996555123469');
        await page.fill('#email', 'mobile@example.com');
        await page.fill('#whatsapp', '+996555123469');
        await page.selectOption('#paymentMethod', 'card');
        
        // Submit the form
        await page.click('#bookingForm button[type="submit"]');
        
        // Wait for payment modal to appear
        await page.waitForSelector('#paymentModal', { state: 'visible' });
        await page.screenshot({ path: 'test-results/mobile-03-payment-modal.png' });
        
        // Click "Я оплатил" button
        const confirmButton = page.locator('#confirmPayment');
        await expect(confirmButton).toBeVisible();
        await confirmButton.click();
        
        // Wait for loading state
        await expect(confirmButton).toContainText('Обработка...');
        
        // Wait for confirmation modal
        await page.waitForSelector('#confirmationModal', { state: 'visible' });
        await page.screenshot({ path: 'test-results/mobile-04-confirmation-modal.png' });
        
        // Check that the confirmation message shows payment confirmed
        const confirmationMessage = page.locator('#confirmationModal .modal-body p');
        await expect(confirmationMessage).toContainText('Оплата подтверждена');
        await expect(confirmationMessage).toContainText('Билет отправлен в WhatsApp');
        
        // Check that the seat is now marked as paid (red)
        const seatElement = page.locator('[data-table="1"][data-seat="14"]');
        await expect(seatElement).toHaveClass(/paid/);
        
        // Take final mobile screenshot
        await page.screenshot({ path: 'test-results/mobile-05-final-state.png' });
    });
    
    test('Error handling for invalid data', async ({ page }) => {
        await page.goto('http://localhost:3000/frontend/index.html');
        await page.waitForLoadState('networkidle');
        
        // Click on a seat
        const seat = page.locator('[data-table="1"][data-seat="15"]');
        await seat.click();
        
        // Wait for booking modal
        await page.waitForSelector('#bookingModal', { state: 'visible' });
        
        // Fill in invalid data (missing required fields)
        await page.fill('#studentName', '');
        await page.fill('#phone', 'invalid-phone');
        
        // Submit the form
        await page.click('#bookingForm button[type="submit"]');
        
        // Wait for payment modal
        await page.waitForSelector('#paymentModal', { state: 'visible' });
        
        // Click "Я оплатил" button
        await page.click('#confirmPayment');
        
        // Should show error message
        await page.waitForTimeout(2000);
        
        // Check for error handling
        const errorMessage = page.locator('text=Ошибка при подтверждении оплаты');
        await expect(errorMessage).toBeVisible();
        
        await page.screenshot({ path: 'test-results/error-handling.png' });
    });
});
