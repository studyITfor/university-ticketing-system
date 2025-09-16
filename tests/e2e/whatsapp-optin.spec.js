// tests/e2e/whatsapp-optin.spec.js
const { test, expect } = require('@playwright/test');

test.describe('WhatsApp Opt-in Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the booking page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('should show opt-in checkbox unchecked by default', async ({ page }) => {
    // Click on a seat to open booking modal
    await page.click('[data-seat-id="1-1"]');
    
    // Wait for booking modal to appear
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    // Check that opt-in checkbox is present and unchecked
    const optinCheckbox = page.locator('#whatsappOptin');
    await expect(optinCheckbox).toBeVisible();
    await expect(optinCheckbox).not.toBeChecked();
    
    // Check that opt-in text is displayed
    const optinText = page.locator('.checkbox-text');
    await expect(optinText).toContainText('Я согласен(а) получать уведомления');
    await expect(optinText).toContainText('GOLDENMIDDLE');
    await expect(optinText).toContainText('STOP');
  });

  test('should validate phone number format', async ({ page }) => {
    // Click on a seat to open booking modal
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    const phoneInput = page.locator('#phone');
    
    // Test invalid phone formats
    await phoneInput.fill('1234567890'); // Missing +
    await expect(phoneInput).toHaveAttribute('data-invalid', 'true');
    
    await phoneInput.fill('+123'); // Too short
    await expect(phoneInput).toHaveAttribute('data-invalid', 'true');
    
    // Test valid phone format
    await phoneInput.fill('+1234567890');
    await expect(phoneInput).not.toHaveAttribute('data-invalid', 'true');
  });

  test('should require opt-in checkbox to be checked for submission', async ({ page }) => {
    // Click on a seat to open booking modal
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    // Fill in required fields
    await page.fill('#firstName', 'Иван');
    await page.fill('#lastName', 'Иванов');
    await page.fill('#phone', '+1234567890');
    
    // Try to submit without checking opt-in checkbox
    await page.click('button[type="submit"]');
    
    // Form should not submit (checkbox is required)
    await expect(page.locator('#bookingModal')).toBeVisible();
  });

  test('should show confirmation modal when opt-in is checked and form is submitted', async ({ page }) => {
    // Mock the API response for opt-in
    await page.route('**/api/optin', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Confirmation code sent to WhatsApp',
          phone: '+1234567890'
        })
      });
    });
    
    // Click on a seat to open booking modal
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    // Fill in required fields
    await page.fill('#firstName', 'Иван');
    await page.fill('#lastName', 'Иванов');
    await page.fill('#phone', '+1234567890');
    
    // Check the opt-in checkbox
    await page.check('#whatsappOptin');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Should show confirmation modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Check that phone number is displayed in confirmation modal
    await expect(page.locator('#confirmationPhone')).toHaveText('+1234567890');
  });

  test('should handle opt-in confirmation code submission', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/optin', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Confirmation code sent to WhatsApp',
          phone: '+1234567890'
        })
      });
    });
    
    await page.route('**/api/confirm-optin', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Opt-in confirmed successfully'
        })
      });
    });
    
    // Complete the booking flow with opt-in
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    await page.fill('#firstName', 'Иван');
    await page.fill('#lastName', 'Иванов');
    await page.fill('#phone', '+1234567890');
    await page.check('#whatsappOptin');
    await page.click('button[type="submit"]');
    
    // Wait for confirmation modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Enter confirmation code
    await page.fill('#confirmationCode', '123456');
    await page.click('#confirmOptin');
    
    // Should show success message
    await expect(page.locator('#confirmationMessage')).toContainText('Подписка на WhatsApp подтверждена');
    
    // Modal should close after success
    await page.waitForSelector('#confirmationCodeModal', { state: 'hidden' });
  });

  test('should handle opt-in API errors gracefully', async ({ page }) => {
    // Mock API error response
    await page.route('**/api/optin', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to send confirmation code'
        })
      });
    });
    
    // Complete the booking flow with opt-in
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    await page.fill('#firstName', 'Иван');
    await page.fill('#lastName', 'Иванов');
    await page.fill('#phone', '+1234567890');
    await page.check('#whatsappOptin');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('.optin-message.error')).toBeVisible();
    await expect(page.locator('.optin-message.error')).toContainText('Ошибка при отправке кода подтверждения');
  });

  test('should update phone display in opt-in text when phone input changes', async ({ page }) => {
    // Click on a seat to open booking modal
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    const phoneInput = page.locator('#phone');
    const optinPhoneDisplay = page.locator('#optinPhoneDisplay');
    
    // Check initial state
    await expect(optinPhoneDisplay).toHaveText('+XXX');
    
    // Type phone number
    await phoneInput.fill('+1234567890');
    
    // Check that opt-in text updates
    await expect(optinPhoneDisplay).toHaveText('+1234567890');
  });

  test('should allow resending confirmation code', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/optin', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Confirmation code sent to WhatsApp',
          phone: '+1234567890'
        })
      });
    });
    
    // Complete the booking flow with opt-in
    await page.click('[data-seat-id="1-1"]');
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    
    await page.fill('#firstName', 'Иван');
    await page.fill('#lastName', 'Иванов');
    await page.fill('#phone', '+1234567890');
    await page.check('#whatsappOptin');
    await page.click('button[type="submit"]');
    
    // Wait for confirmation modal
    await page.waitForSelector('#confirmationCodeModal', { state: 'visible' });
    
    // Click resend button
    await page.click('#resendCode');
    
    // Should show success message
    await expect(page.locator('#confirmationMessage')).toContainText('Код подтверждения отправлен повторно');
  });
});
