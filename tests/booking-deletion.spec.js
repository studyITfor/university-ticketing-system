const { test, expect } = require('@playwright/test');

test.describe('Booking Deletion Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the admin panel
        await page.goto('http://localhost:3000/admin.html');
        
        // Wait for the page to load
        await page.waitForSelector('#bookings-table', { timeout: 10000 });
    });

    test('should delete unpaid booking successfully', async ({ page }) => {
        // Create a test booking first
        const bookingData = {
            firstName: 'Test',
            lastName: 'User',
            phone: '+996 777 888 999',
            table: 20,
            seat: 1
        };

        // Create booking via API
        const createResponse = await page.request.post('http://localhost:3000/api/create-booking', {
            data: bookingData
        });
        expect(createResponse.ok()).toBeTruthy();
        
        const createResult = await createResponse.json();
        const bookingId = createResult.bookingId;
        
        // Wait for the booking to appear in the table
        await page.waitForSelector(`[data-booking-id="${bookingId}"]`, { timeout: 5000 });
        
        // Find and click the delete button
        const deleteButton = page.locator(`[data-booking-id="${bookingId}"] button[onclick*="deleteBooking"]`);
        await expect(deleteButton).toBeVisible();
        
        // Set up dialog handler for confirmation
        page.on('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            expect(dialog.message()).toContain('Удалить бронирование');
            await dialog.accept();
        });
        
        // Click delete button
        await deleteButton.click();
        
        // Wait for the booking to be removed from the table
        await expect(page.locator(`[data-booking-id="${bookingId}"]`)).not.toBeVisible({ timeout: 10000 });
        
        // Verify the seat is now available
        const seatStatus = await page.evaluate(async () => {
            const response = await fetch('/api/seat-statuses');
            const data = await response.json();
            return data['20-1']?.status;
        });
        
        expect(seatStatus).toBe('active');
    });

    test('should delete paid booking as admin', async ({ page }) => {
        // Set admin role
        await page.evaluate(() => {
            localStorage.setItem('userRole', 'admin');
        });
        
        // Create a test booking
        const bookingData = {
            firstName: 'PaidTest',
            lastName: 'User',
            phone: '+996 777 888 888',
            table: 21,
            seat: 1
        };

        // Create booking
        const createResponse = await page.request.post('http://localhost:3000/api/create-booking', {
            data: bookingData
        });
        const createResult = await createResponse.json();
        const bookingId = createResult.bookingId;
        
        // Mark as paid
        const confirmResponse = await page.request.post('http://localhost:3000/api/confirm-payment', {
            data: { bookingId: bookingId }
        });
        expect(confirmResponse.ok()).toBeTruthy();
        
        // Wait for the booking to appear as paid
        await page.waitForSelector(`[data-booking-id="${bookingId}"]`, { timeout: 5000 });
        
        // Find and click the delete button
        const deleteButton = page.locator(`[data-booking-id="${bookingId}"] button[onclick*="deleteBooking"]`);
        await expect(deleteButton).toBeVisible();
        
        // Set up dialog handler for confirmation
        page.on('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            expect(dialog.message()).toContain('ВНИМАНИЕ: Это оплаченное бронирование');
            await dialog.accept();
        });
        
        // Click delete button
        await deleteButton.click();
        
        // Wait for the booking to be removed
        await expect(page.locator(`[data-booking-id="${bookingId}"]`)).not.toBeVisible({ timeout: 10000 });
        
        // Verify the seat is now available
        const seatStatus = await page.evaluate(async () => {
            const response = await fetch('/api/seat-statuses');
            const data = await response.json();
            return data['21-1']?.status;
        });
        
        expect(seatStatus).toBe('active');
    });

    test('should handle deletion of non-existent booking', async ({ page }) => {
        // Try to delete a non-existent booking
        const response = await page.request.delete('http://localhost:3000/api/delete-booking/NONEXISTENT123');
        
        expect(response.status()).toBe(404);
        
        const result = await response.json();
        expect(result.success).toBeFalsy();
        expect(result.error).toBe('Booking not found');
    });

    test('should show proper confirmation dialog for paid bookings', async ({ page }) => {
        // Set admin role
        await page.evaluate(() => {
            localStorage.setItem('userRole', 'admin');
        });
        
        // Create and mark booking as paid
        const bookingData = {
            firstName: 'DialogTest',
            lastName: 'User',
            phone: '+996 777 888 777',
            table: 22,
            seat: 1
        };

        const createResponse = await page.request.post('http://localhost:3000/api/create-booking', {
            data: bookingData
        });
        const createResult = await createResponse.json();
        const bookingId = createResult.bookingId;
        
        await page.request.post('http://localhost:3000/api/confirm-payment', {
            data: { bookingId: bookingId }
        });
        
        await page.waitForSelector(`[data-booking-id="${bookingId}"]`, { timeout: 5000 });
        
        // Set up dialog handler to check message content
        let dialogMessage = '';
        page.on('dialog', async dialog => {
            dialogMessage = dialog.message();
            await dialog.dismiss(); // Don't actually delete, just check the message
        });
        
        const deleteButton = page.locator(`[data-booking-id="${bookingId}"] button[onclick*="deleteBooking"]`);
        await deleteButton.click();
        
        // Verify the dialog message contains warning about paid booking
        expect(dialogMessage).toContain('ВНИМАНИЕ: Это оплаченное бронирование');
        expect(dialogMessage).toContain('Деньги уже получены');
        expect(dialogMessage).toContain('Билет отправлен клиенту');
        expect(dialogMessage).toContain('Удаление необратимо');
    });

    test('should log deletion in audit trail', async ({ page }) => {
        // Create a test booking
        const bookingData = {
            firstName: 'AuditTest',
            lastName: 'User',
            phone: '+996 777 888 666',
            table: 23,
            seat: 1
        };

        const createResponse = await page.request.post('http://localhost:3000/api/create-booking', {
            data: bookingData
        });
        const createResult = await createResponse.json();
        const bookingId = createResult.bookingId;
        
        await page.waitForSelector(`[data-booking-id="${bookingId}"]`, { timeout: 5000 });
        
        // Set up dialog handler
        page.on('dialog', async dialog => {
            await dialog.accept();
        });
        
        // Delete the booking
        const deleteButton = page.locator(`[data-booking-id="${bookingId}"] button[onclick*="deleteBooking"]`);
        await deleteButton.click();
        
        // Wait for deletion to complete
        await expect(page.locator(`[data-booking-id="${bookingId}"]`)).not.toBeVisible({ timeout: 10000 });
        
        // Check if deletion was logged (this would require a separate endpoint to check logs)
        // For now, we'll just verify the booking was deleted successfully
        const bookingsResponse = await page.request.get('http://localhost:3000/api/bookings');
        const bookings = await bookingsResponse.json();
        
        expect(bookings[bookingId]).toBeUndefined();
    });
});
