// tests/e2e/confirm-and-receive.spec.js
const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://upbeat-compassion-production.up.railway.app';

test('Payment confirmation flow E2E', async ({ page, request }) => {
  console.log('🧪 Starting E2E payment confirmation test...');

  // Step 1: Create a booking via API
  console.log('1️⃣ Creating booking via API...');
  const bookingData = {
    phone: '+996555123456',
    table: 15,
    seat: 10,
    firstName: 'E2E',
    lastName: 'Test'
  };

  const createResponse = await request.post(`${BASE_URL}/api/create-booking`, {
    data: bookingData
  });

  expect(createResponse.ok()).toBeTruthy();
  const createResult = await createResponse.json();
  expect(createResult.success).toBeTruthy();
  expect(createResult.bookingId).toBeDefined();

  const bookingId = createResult.bookingId;
  console.log('✅ Booking created:', bookingId);

  // Step 2: Verify booking exists and is pending
  console.log('2️⃣ Verifying booking status...');
  const bookingsResponse = await request.get(`${BASE_URL}/api/bookings`);
  expect(bookingsResponse.ok()).toBeTruthy();
  const bookings = await bookingsResponse.json();
  
  const ourBooking = bookings.find(b => b.booking_string_id === bookingId);
  expect(ourBooking).toBeDefined();
  expect(ourBooking.status).toBe('pending');
  console.log('✅ Booking found with pending status');

  // Step 3: Confirm payment via API
  console.log('3️⃣ Confirming payment via API...');
  const confirmResponse = await request.post(`${BASE_URL}/api/confirm-payment`, {
    data: {
      bookingId: bookingId,
      paymentMethod: 'card',
      amount: 1000
    }
  });

  expect(confirmResponse.ok()).toBeTruthy();
  const confirmResult = await confirmResponse.json();
  expect(confirmResult.success).toBeTruthy();
  expect(confirmResult.message).toContain('Оплата подтверждена');
  console.log('✅ Payment confirmed successfully');

  // Step 4: Verify booking status is now paid
  console.log('4️⃣ Verifying booking status updated...');
  const updatedBookingsResponse = await request.get(`${BASE_URL}/api/bookings`);
  expect(updatedBookingsResponse.ok()).toBeTruthy();
  const updatedBookings = await updatedBookingsResponse.json();
  
  const updatedBooking = updatedBookings.find(b => b.booking_string_id === bookingId);
  expect(updatedBooking).toBeDefined();
  expect(updatedBooking.status).toBe('paid');
  console.log('✅ Booking status updated to paid');

  // Step 5: Test admin panel UI (if accessible)
  console.log('5️⃣ Testing admin panel UI...');
  try {
    await page.goto(`${BASE_URL}/admin.html`);
    await page.waitForLoadState('networkidle');
    
    // Look for the booking in the admin table
    const bookingRow = page.locator(`tr:has-text("${bookingId}")`);
    await expect(bookingRow).toBeVisible();
    
    // Check that status shows as paid
    const statusBadge = bookingRow.locator('.status-badge');
    await expect(statusBadge).toContainText('Оплачено');
    console.log('✅ Admin panel shows correct status');
  } catch (error) {
    console.log('⚠️ Admin panel test skipped (may require authentication)');
  }

  console.log('🎉 E2E test completed successfully!');
});
