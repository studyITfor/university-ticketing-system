# 🧪 API Testing Guide

## University Ticketing System - API Testing

This guide provides comprehensive instructions for testing the University Ticketing System API using Postman.

## 📋 Prerequisites

- Postman installed ([download here](https://www.postman.com/downloads/))
- Deployed application URL (e.g., `https://your-app-name.railway.app`)
- Admin credentials: `admin123`

## 🔧 Step 1: Import Postman Collection

### 1.1 Import Collection

1. Open Postman
2. Click "Import" button
3. Select "File" tab
4. Choose `postman/collection.json` from the project
5. Click "Import"

### 1.2 Set Environment Variables

1. Click on the collection name
2. Go to "Variables" tab
3. Update the following variables:

```
baseUrl: https://your-actual-railway-url.railway.app
bookingId: (will be set automatically after creating a booking)
```

## 🧪 Step 2: Test System Health

### 2.1 Socket.IO Info Test

1. Select "System Health" → "Get Socket.IO Info"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response contains connection count and timestamp

### 2.2 Test Seat Update

1. Select "System Health" → "Test Seat Update"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response confirms seat update was emitted

## 🎫 Step 3: Test Seat Management

### 3.1 Get All Seat Statuses

1. Select "Seat Management" → "Get All Seat Statuses"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response contains array of seat objects with statuses
   - Each seat has: `id`, `status`, `table`, `seat`

<<<<<<< HEAD
## 📝 Step 4: Test Centralized Booking Management

### 4.1 Create New Booking (Centralized)

1. Select "Booking Management (Centralized)" → "Create New Booking (Centralized)"
2. Review the request body (modify if needed):
   ```json
   {
     "firstName": "John",
     "lastName": "Doe",
     "email": "john@university.edu",
     "phone": "+1234567890",
     "seatId": "1-1",
     "table": 1,
     "seat": 1,
     "price": 5900,
     "status": "pending",
     "bookingDate": "2024-01-15T10:30:00.000Z"
=======
## 📝 Step 4: Test Booking Management

### 4.1 Create New Booking

1. Select "Booking Management" → "Create New Booking"
2. Review the request body (modify if needed):
   ```json
   {
     "fullName": "John Doe",
     "email": "john@university.edu",
     "phone": "+1234567890",
     "ticketType": "standard",
     "ticketCount": 2,
     "selectedSeats": ["1-1", "1-2"],
     "totalPrice": 118
>>>>>>> 74c9fcf316183f5cb92f50ddf6239ab0a7130e6a
   }
   ```
3. Click "Send"
4. **Expected Result:**
   - Status: 201 Created
   - Response contains `bookingId`
   - Note the `bookingId` for next tests

<<<<<<< HEAD
### 4.2 Get All Bookings

1. Select "Booking Management (Centralized)" → "Get All Bookings"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response contains array of all bookings
   - Each booking has centralized format with `userInfo` and `metadata`

### 4.3 Get Bookings by Status

1. Select "Booking Management (Centralized)" → "Get Bookings by Status"
2. Modify the `status` query parameter if needed (pending, confirmed, cancelled)
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response contains filtered bookings

### 4.4 Get Single Booking

1. Select "Booking Management (Centralized)" → "Get Single Booking"
2. Ensure `bookingId` variable is set from step 4.1
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response contains single booking details

### 4.5 Confirm Booking

1. Select "Booking Management (Centralized)" → "Confirm Booking"
2. Ensure `bookingId` variable is set
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms booking was confirmed
   - Booking status changes to "confirmed"

### 4.6 Update Booking

1. Select "Booking Management (Centralized)" → "Update Booking"
2. Ensure `bookingId` variable is set
3. Modify the request body if needed
4. Click "Send"
5. **Expected Result:**
   - Status: 200 OK
   - Response confirms booking was updated

### 4.7 Delete Booking

1. Select "Booking Management (Centralized)" → "Delete Booking"
2. Ensure `bookingId` variable is set
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms booking was deleted

### 4.8 Sync Local Bookings

1. Select "Booking Management (Centralized)" → "Sync Local Bookings"
2. Review the request body (contains local bookings with `pendingSync: true`)
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms local bookings were synced

## 📝 Step 5: Test Legacy Booking Management (Backward Compatibility)

### 5.1 Create New Booking (Legacy)

1. Select "Legacy Booking Management" → "Create New Booking (Legacy)"
2. Click "Send"
3. **Expected Result:**
   - Status: 201 Created (redirects to centralized API)
   - Response contains `bookingId`

### 5.2 Confirm Payment (Legacy)

1. Select "Legacy Booking Management" → "Confirm Payment (Legacy)"
2. Ensure `bookingId` variable is set
=======
### 4.2 Confirm Payment

1. Select "Booking Management" → "Confirm Payment"
2. Update the `bookingId` variable with the ID from step 4.1
>>>>>>> 74c9fcf316183f5cb92f50ddf6239ab0a7130e6a
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms payment was processed

<<<<<<< HEAD
### 5.3 Delete Booking (Legacy)

1. Select "Legacy Booking Management" → "Delete Booking (Legacy)"
2. Ensure `bookingId` variable is set
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK (redirects to centralized API)
   - Response confirms booking was deleted

### 5.4 Get Bookings (Legacy JSON)

1. Select "Legacy Booking Management" → "Get Bookings (Legacy JSON)"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response contains JSON file data (if available)

## 📝 Step 6: Test Concurrency and Conflict Scenarios

### 6.1 Test Duplicate Booking (409 Conflict)

1. Select "Concurrency Testing" → "Test Duplicate Booking (409 Conflict)"
2. Click "Send"
3. **Expected Result:**
   - Status: 409 Conflict
   - Response indicates seat is already booked
   - This tests the seat availability check

### 6.2 Test Concurrent Bookings

1. Select "Concurrency Testing" → "Test Concurrent Bookings"
2. Run this request multiple times simultaneously
3. **Expected Result:**
   - Only one booking should succeed
   - Others should return 409 Conflict
   - This tests transaction handling
=======
### 4.3 Delete Booking

1. Select "Booking Management" → "Delete Booking"
2. Ensure `bookingId` variable is set
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms booking was deleted
>>>>>>> 74c9fcf316183f5cb92f50ddf6239ab0a7130e6a

## 👨‍💼 Step 5: Test Admin Functions

### 5.1 Release All Seats

1. Select "Admin Functions" → "Admin Release All Seats"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response confirms all seats were released
   - All seats should now show as "available"

### 5.2 Pre-book Seats (Manual)

1. Select "Admin Functions" → "Admin Pre-book Seats (Manual)"
2. Review the request body:
   ```json
   {
     "adminPassword": "admin123",
     "seatIds": ["2-1", "2-2", "2-3"],
     "prebookType": "manual"
   }
   ```
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms seats were pre-booked
   - Seats should show as "prebooked" status

### 5.3 Pre-book Seats (Random)

1. Select "Admin Functions" → "Admin Pre-book Seats (Random)"
2. Review the request body:
   ```json
   {
     "adminPassword": "admin123",
     "count": 5,
     "prebookType": "random"
   }
   ```
3. Click "Send"
4. **Expected Result:**
   - Status: 200 OK
   - Response confirms 5 random seats were pre-booked

## 🔌 Step 6: Test WebSocket Functionality

### 6.1 Socket.IO Endpoint Test

1. Select "WebSocket Testing" → "Socket.IO Connection Test"
2. Click "Send"
3. **Expected Result:**
   - Status: 200 OK
   - Response shows Socket.IO configuration

### 6.2 Real-Time Testing

1. Open the application in two browser tabs:
   - Tab 1: Admin Panel (`/admin.html`)
   - Tab 2: Student Interface (`/index.html`)
2. In Admin Panel, make changes (book seats, pre-book, etc.)
3. Verify Student Interface updates in real-time
4. Check browser console for WebSocket events

## 📊 Step 7: Performance Testing

### 7.1 Load Testing

1. Use Postman's Collection Runner
2. Set iterations to 10-50
3. Run the entire collection
4. Monitor response times and success rates

### 7.2 Concurrent Testing

1. Open multiple Postman instances
2. Run the same requests simultaneously
3. Verify the system handles concurrent requests

## 🐛 Step 8: Error Testing

### 8.1 Invalid Data Testing

1. Modify request bodies with invalid data
2. Test with missing required fields
3. Test with invalid seat IDs
4. Verify proper error responses

### 8.2 Authentication Testing

1. Test admin functions without password
2. Test with wrong admin password
3. Verify proper authentication errors

## 📈 Step 9: Monitoring and Logs

### 9.1 Railway Logs

1. Go to Railway dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click on latest deployment
5. View logs for any errors

### 9.2 Application Logs

1. Check browser console for client-side errors
2. Monitor WebSocket connection status
3. Verify real-time updates are working

## ✅ Testing Checklist

### Basic Functionality
- [ ] System health endpoints responding
- [ ] Seat status retrieval working
- [ ] Booking creation successful
- [ ] Payment confirmation working
- [ ] Booking deletion successful

### Admin Functions
- [ ] Release all seats working
- [ ] Manual pre-booking working
- [ ] Random pre-booking working
- [ ] Admin authentication working

### WebSocket Features
- [ ] Socket.IO endpoint accessible
- [ ] Real-time updates working
- [ ] Admin-student synchronization working
- [ ] Seat color updates working

### Error Handling
- [ ] Invalid data handled properly
- [ ] Authentication errors working
- [ ] Network errors handled gracefully

## 🚨 Common Issues and Solutions

### Issue: 404 Not Found
**Solution:** Check the base URL is correct and includes the full Railway domain

### Issue: 500 Internal Server Error
**Solution:** Check Railway logs for server-side errors

### Issue: WebSocket Not Connecting
**Solution:** Verify the application is deployed and running on Railway

### Issue: Real-time Updates Not Working
**Solution:** Check browser console for WebSocket errors and verify Socket.IO configuration

## 📞 Support

If you encounter issues during testing:

1. Check Railway logs first
2. Verify all environment variables are set
3. Test locally with `npm start`
4. Check the deployment guide for troubleshooting steps

---

**🎉 Happy Testing!** This comprehensive testing suite ensures your University Ticketing System is working perfectly on Railway.
