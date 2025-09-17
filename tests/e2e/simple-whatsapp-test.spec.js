// tests/e2e/simple-whatsapp-test.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Simple WhatsApp Integration Test', () => {
  test('should handle WhatsApp opt-in without errors', async ({ page }) => {
    console.log('🔍 Starting simple WhatsApp test...');

    // Navigate to the page
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(`Page error: ${error.message}`);
    });

    // Test API endpoint directly
    const response = await page.request.post('http://localhost:3000/api/optin', {
      data: {
        name: 'Test',
        surname: 'User',
        phone: '+996555245629',
        optin_source: 'booking_form',
        booking_id: 'test-123'
      }
    });

    const responseBody = await response.json();
    console.log('API Response:', responseBody);

    // Verify response is valid JSON and successful
    expect(response.status()).toBe(200);
    expect(responseBody.success).toBe(true);
    expect(responseBody.provider).toBe('green_api');

    // Verify no console errors occurred
    expect(errors).toHaveLength(0);

    console.log('✅ Simple WhatsApp test passed');
  });

  test('should handle invalid phone format', async ({ page }) => {
    console.log('🔍 Testing invalid phone format...');

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Test with invalid phone format
    const response = await page.request.post('http://localhost:3000/api/optin', {
      data: {
        name: 'Test',
        surname: 'User',
        phone: '996555245629', // Missing + prefix
        optin_source: 'booking_form',
        booking_id: 'test-123'
      }
    });

    const responseBody = await response.json();
    console.log('API Response for invalid phone:', responseBody);

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);
    expect(responseBody.success).toBe(false);
    expect(responseBody.code).toBe('INVALID_PHONE_FORMAT');

    console.log('✅ Invalid phone format test passed');
  });
});
