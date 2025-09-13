const { test, expect } = require('@playwright/test');

test.describe('University Ticketing System - Comprehensive Test', () => {
    test('Complete booking flow with phone validation and deletion', async ({ page }) => {
        // Navigate to the student portal
        await page.goto('http://localhost:3000');
        
        // Wait for the page to load
        await page.waitForLoadState('networkidle');
        
        // Test phone validation - try invalid phone first
        await page.fill('#firstName', 'Test');
        await page.fill('#lastName', 'User');
        await page.fill('#studentId', '12345');
        await page.fill('#phone', '123456789'); // Invalid phone (no +)
        await page.selectOption('#table', '1');
        await page.selectOption('#seat', '3');
        
        // Try to submit with invalid phone
        await page.click('button[type="submit"]');
        
        // Check for validation error
        const errorMessage = await page.textContent('.error-message, .alert-danger, [class*="error"]');
        expect(errorMessage).toContain('+');
        
        // Now test with valid phone
        await page.fill('#phone', '+996777123456');
        await page.click('button[type="submit"]');
        
        // Wait for success message
        await page.waitForSelector('.alert-success, [class*="success"]', { timeout: 10000 });
        
        // Get the booking ID from the success message
        const successMessage = await page.textContent('.alert-success, [class*="success"]');
        const bookingIdMatch = successMessage.match(/[A-Z0-9]{10,}/);
        expect(bookingIdMatch).toBeTruthy();
        
        const bookingId = bookingIdMatch[0];
        console.log('Created booking with ID:', bookingId);
        
        // Navigate to admin panel
        await page.goto('http://localhost:3000/admin.html');
        await page.waitForLoadState('networkidle');
        
        // Wait for bookings to load
        await page.waitForSelector('table tbody tr', { timeout: 10000 });
        
        // Find the booking in the admin panel
        const bookingRow = page.locator(`tr:has-text("${bookingId}")`);
        await expect(bookingRow).toBeVisible();
        
        // Test deletion - click delete button
        const deleteButton = bookingRow.locator('button:has-text("Удалить"), button:has-text("Delete")');
        await expect(deleteButton).toBeVisible();
        
        // Click delete and confirm
        await deleteButton.click();
        
        // Handle confirmation dialog
        page.on('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            await dialog.accept();
        });
        
        // Wait for deletion success
        await page.waitForSelector('.alert-success, [class*="success"]', { timeout: 10000 });
        
        // Verify booking is removed from table
        await expect(bookingRow).not.toBeVisible();
        
        console.log('✅ All tests passed: phone validation, booking creation, and deletion');
    });
    
    test('Test paid booking deletion', async ({ page }) => {
        // Create a booking via API
        const response = await page.request.post('http://localhost:3000/api/create-booking', {
            data: {
                firstName: 'Paid',
                lastName: 'Test',
                studentId: '54321',
                phone: '+996777654321',
                table: 2,
                seat: 1
            }
        });
        
        expect(response.ok()).toBeTruthy();
        const bookingData = await response.json();
        const bookingId = bookingData.bookingId;
        
        // Confirm payment
        const paymentResponse = await page.request.post('http://localhost:3000/api/confirm-payment', {
            data: { bookingId }
        });
        
        expect(paymentResponse.ok()).toBeTruthy();
        console.log('Payment confirmed for booking:', bookingId);
        
        // Navigate to admin panel
        await page.goto('http://localhost:3000/admin.html');
        await page.waitForLoadState('networkidle');
        
        // Wait for bookings to load
        await page.waitForSelector('table tbody tr', { timeout: 10000 });
        
        // Find the paid booking
        const bookingRow = page.locator(`tr:has-text("${bookingId}")`);
        await expect(bookingRow).toBeVisible();
        
        // Verify it shows as paid
        const statusCell = bookingRow.locator('td').nth(6); // Assuming status is in 7th column
        await expect(statusCell).toContainText('Оплачен');
        
        // Test deletion of paid booking
        const deleteButton = bookingRow.locator('button:has-text("Удалить"), button:has-text("Delete")');
        await expect(deleteButton).toBeVisible();
        
        // Click delete and confirm
        await deleteButton.click();
        
        // Handle confirmation dialog
        page.on('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            await dialog.accept();
        });
        
        // Wait for deletion success
        await page.waitForSelector('.alert-success, [class*="success"]', { timeout: 10000 });
        
        // Verify booking is removed
        await expect(bookingRow).not.toBeVisible();
        
        console.log('✅ Paid booking deletion test passed');
    });
});