// tests/e2e/confirm-and-whatsapp.spec.js
const { test, expect } = require('@playwright/test');
const axios = require('axios');

const BASE_URL = 'https://upbeat-compassion-production.up.railway.app';

test.describe('Payment Confirmation and WhatsApp E2E Flow', () => {
  let bookingId;
  let testPhone = '+996555123456';
  let testFirstName = 'Playwright';
  let testLastName = 'Test';
  let testTable = 25;
  let testSeat = 5;

  test('should create booking, confirm payment, and verify WhatsApp sending', async ({ request }) => {
    // 1. Create a booking via API
    console.log('🎫 Creating booking...');
    const createBookingResponse = await request.post(`${BASE_URL}/api/create-booking`, {
      data: {
        phone: testPhone,
        firstName: testFirstName,
        lastName: testLastName,
        table: testTable,
        seat: testSeat,
        eventId: 1
      }
    });
    
    expect(createBookingResponse.ok()).toBeTruthy();
    const createBookingData = await createBookingResponse.json();
    expect(createBookingData.success).toBe(true);
    bookingId = createBookingData.bookingId;
    console.log('✅ Created booking:', bookingId);

    // 2. Verify initial booking status
    console.log('🔍 Verifying initial booking status...');
    const initialBookingResponse = await request.get(`${BASE_URL}/api/bookings`);
    expect(initialBookingResponse.ok()).toBeTruthy();
    const initialBookings = await initialBookingResponse.json();
    const initialBooking = initialBookings.find(b => b.booking_string_id === bookingId || b.id.toString() === bookingId);
    expect(initialBooking).toBeDefined();
    expect(initialBooking.status).toBe('pending');
    console.log('✅ Initial status verified:', initialBooking.status);

    // 3. Confirm payment for the created booking
    console.log('💳 Confirming payment...');
    const confirmPaymentResponse = await request.post(`${BASE_URL}/api/confirm-payment`, {
      data: {
        bookingId: bookingId,
        paymentMethod: 'card',
        amount: 1000
      }
    });
    
    expect(confirmPaymentResponse.ok()).toBeTruthy();
    const confirmPaymentData = await confirmPaymentResponse.json();
    expect(confirmPaymentData.success).toBe(true);
    expect(confirmPaymentData.message).toContain('Оплата подтверждена');
    expect(confirmPaymentData.ticketId).toBeDefined();
    console.log('✅ Payment confirmed:', confirmPaymentData);

    // 4. Verify booking status is updated to 'paid'
    console.log('🔍 Verifying updated booking status...');
    const finalBookingResponse = await request.get(`${BASE_URL}/api/bookings`);
    expect(finalBookingResponse.ok()).toBeTruthy();
    const finalBookings = await finalBookingResponse.json();
    const finalBooking = finalBookings.find(b => b.booking_string_id === bookingId || b.id.toString() === bookingId);
    expect(finalBooking).toBeDefined();
    expect(finalBooking.status).toBe('paid');
    expect(finalBooking.whatsapp_sent).toBe(true);
    expect(finalBooking.ticket_id).toBeDefined();
    console.log('✅ Final status verified:', {
      status: finalBooking.status,
      whatsapp_sent: finalBooking.whatsapp_sent,
      ticket_id: finalBooking.ticket_id
    });

    // 5. Test resend ticket functionality
    console.log('🔄 Testing resend ticket...');
    const resendTicketResponse = await request.post(`${BASE_URL}/api/resend-ticket`, {
      data: {
        bookingId: bookingId
      }
    });
    
    expect(resendTicketResponse.ok()).toBeTruthy();
    const resendTicketData = await resendTicketResponse.json();
    expect(resendTicketData.success).toBe(true);
    expect(resendTicketData.message).toContain('Билет переотправлен');
    console.log('✅ Ticket resent successfully:', resendTicketData);

    // 6. Verify payments table has correct data
    console.log('🔍 Verifying payments table...');
    const paymentsResponse = await request.get(`${BASE_URL}/api/debug/db-investigation`);
    if (paymentsResponse.ok()) {
      const paymentsData = await paymentsResponse.json();
      const payment = paymentsData.recentPayments.find(p => p.booking_id === bookingId);
      if (payment) {
        expect(payment.booking_id).toBe(bookingId);
        expect(payment.status).toBe('confirmed');
        expect(payment.user_phone).toBe(testPhone);
        console.log('✅ Payment record verified:', {
          booking_id: payment.booking_id,
          status: payment.status,
          phone: payment.user_phone
        });
      }
    }

    console.log('🎉 All tests passed! Complete payment confirmation flow working correctly.');
  });

  test('should handle idempotent payment confirmation', async ({ request }) => {
    // Use the booking from previous test
    if (!bookingId) {
      test.skip('No booking ID available from previous test');
      return;
    }

    console.log('🔄 Testing idempotent payment confirmation...');
    const confirmPaymentResponse = await request.post(`${BASE_URL}/api/confirm-payment`, {
      data: {
        bookingId: bookingId,
        paymentMethod: 'card',
        amount: 1000
      }
    });
    
    expect(confirmPaymentResponse.ok()).toBeTruthy();
    const confirmPaymentData = await confirmPaymentResponse.json();
    expect(confirmPaymentData.success).toBe(true);
    expect(confirmPaymentData.message).toContain('уже подтверждена');
    console.log('✅ Idempotent confirmation working:', confirmPaymentData.message);
  });
});
