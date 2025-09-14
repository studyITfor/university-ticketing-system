const { test, expect } = require('@playwright/test');

test.describe('GOLDENMIDDLE E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page
    await page.goto('http://localhost:3000');
  });

  test('should load the main page correctly', async ({ page }) => {
    // Check if the page loads with correct title
    await expect(page).toHaveTitle(/GOLDENMIDDLE/);
    
    // Check if the event information is displayed
    await expect(page.locator('.event-title')).toContainText('GOLDENMIDDLE');
    
    // Check if the price is updated to 5500
    await expect(page.locator('.legend-item')).toContainText('5500 Som');
  });

  test('should show phone-only booking form', async ({ page }) => {
    // Click on a seat to start booking
    await page.click('.seat-curved[data-seat-id="1-1"]');
    
    // Check if the booking modal appears
    await expect(page.locator('.booking-modal')).toBeVisible();
    
    // Check if only phone field is present (no email field)
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).not.toBeVisible();
    
    // Check if phone placeholder is in E.164 format
    await expect(page.locator('input[name="phone"]')).toHaveAttribute('placeholder', '+996555123456');
  });

  test('should validate phone number format', async ({ page }) => {
    // Click on a seat to start booking
    await page.click('.seat-curved[data-seat-id="1-1"]');
    
    // Fill in invalid phone number
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="phone"]', '123456'); // Invalid format
    
    // Try to submit
    await page.click('button[type="submit"]');
    
    // Should show validation error
    await expect(page.locator('body')).toContainText('Please enter a valid phone number in E.164 format');
  });

  test('should accept valid phone number and create booking', async ({ page }) => {
    // Click on a seat to start booking
    await page.click('.seat-curved[data-seat-id="1-1"]');
    
    // Fill in valid information
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="phone"]', '+996555123456');
    
    // Submit booking
    await page.click('button[type="submit"]');
    
    // Should show payment information
    await expect(page.locator('.payment-details')).toBeVisible();
    
    // Check if bank information is updated
    await expect(page.locator('.bank-info')).toContainText('0772 110 310');
    await expect(page.locator('.bank-info')).toContainText('Алина А.');
    
    // Check if price is 5500
    await expect(page.locator('#paymentAmount')).toContainText('5500 Som');
  });

  test('should show updated bank information', async ({ page }) => {
    // Click on a seat to start booking
    await page.click('.seat-curved[data-seat-id="1-1"]');
    
    // Fill in information
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="phone"]', '+996555123456');
    
    // Submit booking
    await page.click('button[type="submit"]');
    
    // Check payment information
    await expect(page.locator('.bank-details')).toContainText('0772 110 310');
    await expect(page.locator('.bank-details')).toContainText('Алина А.');
    
    // Check that bank card icon is removed
    await expect(page.locator('.fas.fa-credit-card')).not.toBeVisible();
  });

  test('should handle payment confirmation flow', async ({ page }) => {
    // This test would require the backend to be running
    // For now, we'll just check the UI elements
    
    // Click on a seat to start booking
    await page.click('.seat-curved[data-seat-id="1-1"]');
    
    // Fill in information
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="phone"]', '+996555123456');
    
    // Submit booking
    await page.click('button[type="submit"]');
    
    // Check if payment confirmation button exists
    await expect(page.locator('button:has-text("Confirm Payment")')).toBeVisible();
  });

  test('should show health check endpoints', async ({ page }) => {
    // Test health check endpoint
    const response = await page.request.get('http://localhost:3000/api/health');
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData.status).toBe('ok');
    expect(healthData).toHaveProperty('uptime_seconds');
    expect(healthData).toHaveProperty('db');
  });

  test('should show readiness check', async ({ page }) => {
    // Test readiness check endpoint
    const response = await page.request.get('http://localhost:3000/api/health/readiness');
    expect(response.status()).toBe(200);
    
    const readinessData = await response.json();
    expect(readinessData).toHaveProperty('status');
    expect(readinessData).toHaveProperty('ready');
  });
});

test.describe('Admin Panel Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the admin panel
    await page.goto('http://localhost:3000/admin.html');
  });

  test('should load admin panel correctly', async ({ page }) => {
    // Check if admin panel loads
    await expect(page.locator('h1')).toContainText('Admin Panel');
    
    // Check if bookings table is present
    await expect(page.locator('#bookingsTable')).toBeVisible();
  });

  test('should show updated status text in English', async ({ page }) => {
    // Check if status text is in English
    await expect(page.locator('body')).toContainText('Pending Payment');
    await expect(page.locator('body')).toContainText('Paid');
    await expect(page.locator('body')).toContainText('Booked');
  });

  test('should show admin action buttons', async ({ page }) => {
    // Check if admin action buttons are present
    await expect(page.locator('button:has-text("Confirm Payment")')).toBeVisible();
    await expect(page.locator('button:has-text("Delete")')).toBeVisible();
  });
});
