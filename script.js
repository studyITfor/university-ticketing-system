// Main Ticketing System for Students
class StudentTicketingSystem {
    constructor() {
        this.totalTables = 36;
        this.seatsPerTable = 14;
        this.totalSeats = this.totalTables * this.seatsPerTable;
        this.ticketPrice = 5900;
        this.selectedSeats = new Set();
        this.bookedSeats = new Set();
        this.prebookedSeats = new Set();
        this.pendingSeats = new Set();
        this.currentZoom = 1;
        this.currentPanX = 0;
        this.currentPanY = 0;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.currentBookingSeat = null;
        this.tempBookingData = null;
        this.modalReadyForSubmission = false; // Store temporary booking data before payment
        this.realTimeUpdateInterval = null;
        this.lastUpdateTime = Date.now();
        this.socket = null;
        
        // Touch/pinch zoom properties
        this.touches = [];
        this.lastTouchDistance = 0;
        this.isPinching = false;
        this.lastPinchCenter = { x: 0, y: 0 };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.generateHallLayout();
        this.loadSavedData();
        this.updateStatistics();
        this.syncExistingBookings();
        // Initialize Socket.IO connection for real-time updates
        this.initializeSocket();
        
        // Test validation logic on startup (for debugging)
        setTimeout(() => {
            this.testValidation();
        }, 2000);
    }

    setupEventListeners() {
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());

        // Hall layout pan and zoom
        const hallLayout = document.getElementById('hallLayout');
        hallLayout.addEventListener('mousedown', (e) => this.startDrag(e));
        hallLayout.addEventListener('mousemove', (e) => this.drag(e));
        hallLayout.addEventListener('mouseup', () => this.endDrag());
        hallLayout.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Touch events for mobile pinch-to-zoom
        hallLayout.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        hallLayout.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        hallLayout.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Seat selection - both click and touch events
        document.getElementById('hallContent').addEventListener('click', (e) => {
            if (e.target.classList.contains('seat')) {
                this.handleSeatClick(e.target, e);
            }
        });
        
        // Touch support for seat selection on mobile
        document.getElementById('hallContent').addEventListener('touchend', (e) => {
            // Only handle seat selection if not pinching/panning
            if (!this.isPinching && !this.isDragging && e.target.classList.contains('seat')) {
                e.preventDefault();
                this.handleSeatClick(e.target, e);
            }
        });

        // Modal controls
        document.getElementById('closeBookingModal').addEventListener('click', () => {
            this.handleBookingCancellation();
            this.hideModal('bookingModal');
        });

        document.getElementById('closePaymentModal').addEventListener('click', () => {
            this.handleBookingCancellation();
            this.hideModal('paymentModal');
        });

        document.getElementById('closeConfirmationModal').addEventListener('click', () => {
            this.hideModal('confirmationModal');
        });

        document.getElementById('cancelBooking').addEventListener('click', () => {
            this.handleBookingCancellation();
            this.hideModal('bookingModal');
        });

        document.getElementById('closeConfirmation').addEventListener('click', () => {
            this.hideModal('confirmationModal');
        });

        // Booking form
        document.getElementById('bookingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('🔍 DEBUG: Form submit event triggered by:', e.submitter || 'unknown');
            console.log('🔍 DEBUG: Event target:', e.target);
            console.log('🔍 DEBUG: Event type:', e.type);
            console.log('🔍 DEBUG: Current booking seat:', this.currentBookingSeat);
            
            // Prevent submission if no seat is selected (shouldn't happen, but safety check)
            if (!this.currentBookingSeat) {
                console.log('⚠️ DEBUG: No seat selected for booking!');
                alert('DEBUG: No seat selected. Please click on a seat first.');
                return;
            }
            
            // Prevent premature submission (before user has time to fill form)
            if (!this.modalReadyForSubmission) {
                console.log('⚠️ DEBUG: Form submitted too early - modal not ready yet!');
                alert('DEBUG: Please wait a moment for the form to load, then fill it out before submitting.');
                return;
            }
            
            // Check if form has any values before processing
            const form = document.getElementById('bookingForm');
            const formData = new FormData(form);
            let hasValues = false;
            const fieldValues = {};
            
            for (let [key, value] of formData.entries()) {
                fieldValues[key] = value;
                if (value && value.trim()) {
                    hasValues = true;
                }
            }
            
            console.log('🔍 DEBUG: Form field values:', fieldValues);
            console.log('🔍 DEBUG: Has values:', hasValues);
            
            if (!hasValues) {
                console.log('⚠️ DEBUG: Form submitted with no values - this might be the issue!');
                console.log('🔍 DEBUG: This suggests the form is being submitted before user fills it out');
                alert('DEBUG: Form was submitted with empty values. Please fill out the form first, then click "Забронировать место".');
                return;
            }
            
            // Add a small delay to ensure form data is captured
            setTimeout(() => {
                this.handleBookingSubmission();
            }, 100);
        });

        // Payment confirmation
        document.getElementById('confirmPayment').addEventListener('click', () => {
            this.handlePaymentConfirmation();
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    generateHallLayout() {
        const container = document.getElementById('hallContent');
        container.innerHTML = '';

        // Create 6x6 grid of tables
        const tablesGrid = document.createElement('div');
        tablesGrid.className = 'tables-grid';

        for (let table = 1; table <= this.totalTables; table++) {
            const tableElement = this.createTable(table);
            tablesGrid.appendChild(tableElement);
        }

        container.appendChild(tablesGrid);
    }

    createTable(tableNumber) {
        const tableDiv = document.createElement('div');
        tableDiv.className = 'table';

        // Table number
        const tableNumberDiv = document.createElement('div');
        tableNumberDiv.className = 'table-number';
        tableNumberDiv.textContent = `Стол ${tableNumber}`;
        tableDiv.appendChild(tableNumberDiv);

        // Table circle
        const tableCircle = document.createElement('div');
        tableCircle.className = 'table-circle';

        // Seats container
        const seatsContainer = document.createElement('div');
        seatsContainer.className = 'seats-container';

        // Create 14 seats around the table in a circle
        for (let seat = 1; seat <= this.seatsPerTable; seat++) {
            const seatElement = document.createElement('div');
            seatElement.className = 'seat available';
            seatElement.textContent = seat;
            seatElement.dataset.table = tableNumber;
            seatElement.dataset.seat = seat;
            seatElement.dataset.seatId = `${tableNumber}-${seat}`;

            // Position seats in a circle around the table
            const angle = (seat - 1) * (360 / this.seatsPerTable);
            const radius = 50; // Distance from center
            const x = 50 + radius * Math.cos(angle * Math.PI / 180);
            const y = 50 + radius * Math.sin(angle * Math.PI / 180);

            seatElement.style.left = `${x}%`;
            seatElement.style.top = `${y}%`;
            seatElement.style.transform = 'translate(-50%, -50%)';

            seatsContainer.appendChild(seatElement);
        }

        tableCircle.appendChild(seatsContainer);
        tableDiv.appendChild(tableCircle);

        return tableDiv;
    }


    updateBookingSummary() {
        const count = this.selectedSeats.size;
        const total = count * this.ticketPrice;
        
        document.querySelector('.selected-count').textContent = count;
        document.querySelector('.total-price').textContent = `${total.toLocaleString()} Сом`;
    }

    showBookingModal(seatId) {
        const [table, seat] = seatId.split('-');
        
        document.getElementById('seatInfo').textContent = `Стол ${table}, Место ${seat}`;
        document.getElementById('seatPrice').textContent = `${this.ticketPrice.toLocaleString()} Сом`;
        
        // Store current seat for booking
        this.currentBookingSeat = seatId;
        
        console.log('🔍 DEBUG: Opening booking modal for seat:', seatId);
        
        // Reset form and prepare for user input
        const form = document.getElementById('bookingForm');
        form.reset();
        this.modalReadyForSubmission = false;
        
        this.showModal('bookingModal');
        
        // Allow submission after a short delay to ensure user interaction
        setTimeout(() => {
            this.modalReadyForSubmission = true;
            console.log('🔍 DEBUG: Modal ready for form submission');
        }, 1000);
    }

    async handleBookingSubmission() {
        const form = document.getElementById('bookingForm');
        console.log('🔍 DEBUG: Form element found:', !!form);
        
        // Debug: Check form inputs directly
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        const phoneInput = document.getElementById('phone');
        const emailInput = document.getElementById('email');
        
        console.log('🔍 DEBUG: Input elements:');
        console.log('  firstName:', firstNameInput?.value);
        console.log('  lastName:', lastNameInput?.value);
        console.log('  phone:', phoneInput?.value);
        console.log('  email:', emailInput?.value);
        
        const formData = new FormData(form);
        
        // Debug: Log all form data
        console.log('🔍 DEBUG: Form data capture:');
        for (let [key, value] of formData.entries()) {
            console.log(`  ${key}: "${value}" (length: ${value.length})`);
        }
        
        const bookingData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            seatId: this.currentBookingSeat,
            table: this.currentBookingSeat.split('-')[0],
            seat: this.currentBookingSeat.split('-')[1],
            price: this.ticketPrice,
            status: 'pending',
            bookingDate: new Date().toISOString()
        };

        // Debug: Log booking data
        console.log('🔍 DEBUG: Booking data object:', bookingData);

        // Validate form
        if (!this.validateBooking(bookingData)) {
            return;
        }

        try {
            // Store temporary booking data for payment confirmation
            // DON'T save to server yet - only after payment confirmation
            this.tempBookingData = bookingData;
            
            // Keep seat selected (blue) until payment is confirmed
            this.selectedSeats.add(this.currentBookingSeat);
            this.updateSeatDisplay();
            this.updateBookingSummary();
            
            // Show payment modal
            this.hideModal('bookingModal');
            this.showPaymentModal(bookingData);
            
            // Clear form
            document.getElementById('bookingForm').reset();
            
            console.log('✅ Booking form submitted - waiting for payment confirmation');
        } catch (error) {
            console.error('Failed to submit booking:', error);
            alert('Ошибка при обработке бронирования: ' + error.message);
        }
    }

    showPaymentModal(bookingData) {
        document.getElementById('paymentAmount').textContent = `${bookingData.price.toLocaleString()} Сом`;
        
        // Show booking ID if available
        if (this.currentBookingId) {
            const bookingIdElement = document.getElementById('bookingId');
            if (bookingIdElement) {
                bookingIdElement.textContent = `ID бронирования: ${this.currentBookingId}`;
                bookingIdElement.style.display = 'block';
            }
        }
        
        this.showModal('paymentModal');
    }

    async handlePaymentConfirmation() {
        if (!this.currentBookingSeat || !this.tempBookingData) {
            console.error('❌ No booking data available for payment confirmation');
            return;
        }

        try {
            console.log('💳 Processing payment confirmation...');
            
            // NOW save booking to server after payment confirmation
            await this.saveBooking(this.tempBookingData);
            
            // Mark seat as pending (yellow) after successful server booking
            this.pendingSeats.add(this.currentBookingSeat);
            this.selectedSeats.delete(this.currentBookingSeat);
            this.updateSeatDisplay();
            this.updateBookingSummary();
            
            // Show confirmation message
            this.hideModal('paymentModal');
            this.showConfirmationModal();
            
            // Save data
            this.saveData();
            
            // Start real-time updates to get admin confirmation
            this.startRealTimeUpdates();
            
            // Clear temporary data
            this.tempBookingData = null;
            this.currentBookingSeat = null;
            
            console.log('✅ Payment confirmed and booking saved to server');
        } catch (error) {
            console.error('❌ Error confirming payment:', error);
            alert('Ошибка при подтверждении оплаты: ' + error.message);
        }
    }

    // Handle booking cancellation
    handleBookingCancellation() {
        if (this.currentBookingSeat) {
            // Return seat to available state
            this.pendingSeats.delete(this.currentBookingSeat);
            this.selectedSeats.delete(this.currentBookingSeat);
            this.updateSeatDisplay();
            this.updateBookingSummary();
            
            // Clear temporary booking data
            this.tempBookingData = null;
            this.currentBookingSeat = null;
            
            console.log('❌ Booking cancelled - seat returned to available state');
        }
    }

    validateBooking(data) {
        const errors = [];

        // Debug: Log validation data
        console.log('🔍 DEBUG: Validation data:', {
            firstName: `"${data.firstName}" (type: ${typeof data.firstName})`,
            lastName: `"${data.lastName}" (type: ${typeof data.lastName})`,
            phone: `"${data.phone}" (type: ${typeof data.phone})`,
            email: `"${data.email}" (type: ${typeof data.email})`
        });

        if (!data.firstName || !data.firstName?.trim()) errors.push('Имя обязательно');
        if (!data.lastName || !data.lastName?.trim()) errors.push('Фамилия обязательна');
        if (!data.phone || !data.phone?.trim()) errors.push('Телефон обязателен');
        if (!data.email || !data.email?.trim()) errors.push('Электронная почта обязательна');

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (data.email && !emailRegex.test(data.email)) {
            errors.push('Пожалуйста, введите корректный адрес электронной почты');
        }

        // Phone validation
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (data.phone && !phoneRegex.test(data.phone.replace(/\s/g, ''))) {
            errors.push('Пожалуйста, введите корректный номер телефона');
        }

        if (errors.length > 0) {
            alert('Пожалуйста, исправьте следующие ошибки:\n' + errors.join('\n'));
            return false;
        }

        return true;
    }

    // Test function to validate the validation logic
    testValidation() {
        console.log('🧪 Testing validation logic...');
        
        // Test with empty data
        const emptyData = { firstName: '', lastName: '', phone: '', email: '' };
        console.log('🧪 Test 1 - Empty data:', this.validateBooking(emptyData));
        
        // Test with filled data
        const filledData = { 
            firstName: 'Иван', 
            lastName: 'Иванов', 
            phone: '+996555123456', 
            email: 'ivan@example.com' 
        };
        console.log('🧪 Test 2 - Filled data:', this.validateBooking(filledData));
        
        // Test with null data
        const nullData = { firstName: null, lastName: null, phone: null, email: null };
        console.log('🧪 Test 3 - Null data:', this.validateBooking(nullData));
        
        // Test with undefined data
        const undefinedData = { firstName: undefined, lastName: undefined, phone: undefined, email: undefined };
        console.log('🧪 Test 4 - Undefined data:', this.validateBooking(undefinedData));
    }

    async saveBooking(bookingData) {
        try {
            // Send booking to server
            const response = await fetch('/api/create-booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookingData)
            });

            const result = await response.json();

            if (result.success) {
                // Update local storage with server response
                const bookings = this.getBookings();
                bookingData.id = result.bookingId;
                bookings[result.bookingId] = bookingData;
                localStorage.setItem('zolotayaSeredinaBookings', JSON.stringify(bookings));
                
                // Store booking ID for later use
                this.currentBookingId = result.bookingId;
                
                console.log('Booking saved to server:', result.bookingId);
            } else {
                throw new Error(result.error || 'Failed to save booking');
            }
        } catch (error) {
            console.error('Error saving booking to server:', error);
            alert('Ошибка при сохранении бронирования: ' + error.message);
            throw error;
        }
    }

    getBookings() {
        const saved = localStorage.getItem('zolotayaSeredinaBookings');
        return saved ? JSON.parse(saved) : {};
    }

    async syncExistingBookings() {
        try {
            const localBookings = this.getBookings();
            const bookingCount = Object.keys(localBookings).length;
            
            if (bookingCount > 0) {
                console.log(`Found ${bookingCount} existing bookings in localStorage, syncing to server...`);
                
                const response = await fetch('/api/sync-bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ bookings: localBookings })
                });

                const result = await response.json();

                if (result.success && result.syncedCount > 0) {
                    console.log(`Successfully synced ${result.syncedCount} bookings to server`);
                }
            }
        } catch (error) {
            console.error('Error syncing existing bookings:', error);
            // Don't show error to user as this is a background operation
        }
    }

    showConfirmationModal() {
        const [table, seat] = this.currentBookingSeat.split('-');
        document.getElementById('confirmedSeat').textContent = 
            `Стол ${table}, Место ${seat}`;
            
        // Show booking ID if available
        if (this.currentBookingId) {
            const bookingIdElement = document.getElementById('confirmedBookingId');
            if (bookingIdElement) {
                bookingIdElement.textContent = `ID бронирования: ${this.currentBookingId}`;
            }
        }
        
        // Update confirmation message to reflect pending status
        const confirmationMessage = document.querySelector('#confirmationModal .modal-body p');
        if (confirmationMessage) {
            confirmationMessage.textContent = 'Ваша заявка на бронирование отправлена и ожидает подтверждения администратора. Место будет зарезервировано после подтверждения оплаты.';
        }
        
        this.showModal('confirmationModal');
    }

    // Zoom and Pan functionality
    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom * 1.2, 3);
        this.updateTransform();
    }

    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom / 1.2, 0.5);
        this.updateTransform();
    }

    resetZoom() {
        this.currentZoom = 1;
        this.currentPanX = 0;
        this.currentPanY = 0;
        this.updateTransform();
    }

    updateTransform() {
        const hallContent = document.getElementById('hallContent');
        hallContent.style.transform = `translate(${this.currentPanX}px, ${this.currentPanY}px) scale(${this.currentZoom})`;
    }

    startDrag(e) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX - this.currentPanX, y: e.clientY - this.currentPanY };
        document.getElementById('hallLayout').style.cursor = 'grabbing';
    }

    drag(e) {
        if (!this.isDragging) return;
        
        this.currentPanX = e.clientX - this.dragStart.x;
        this.currentPanY = e.clientY - this.dragStart.y;
        this.updateTransform();
    }

    endDrag() {
        this.isDragging = false;
        document.getElementById('hallLayout').style.cursor = 'grab';
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.currentZoom = Math.max(0.5, Math.min(3, this.currentZoom * delta));
        this.updateTransform();
    }

    // Touch handling methods for mobile pinch-to-zoom
    handleTouchStart(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        
        if (this.touches.length === 1) {
            // Single touch - start panning
            this.isDragging = true;
            this.isPinching = false;
            this.dragStart = { 
                x: this.touches[0].clientX - this.currentPanX, 
                y: this.touches[0].clientY - this.currentPanY 
            };
        } else if (this.touches.length === 2) {
            // Two touches - start pinching
            this.isPinching = true;
            this.isDragging = false;
            this.lastTouchDistance = this.getTouchDistance(this.touches[0], this.touches[1]);
            this.lastPinchCenter = this.getTouchCenter(this.touches[0], this.touches[1]);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        
        if (this.isPinching && this.touches.length === 2) {
            // Handle pinch-to-zoom
            const currentDistance = this.getTouchDistance(this.touches[0], this.touches[1]);
            const currentCenter = this.getTouchCenter(this.touches[0], this.touches[1]);
            
            if (this.lastTouchDistance > 0) {
                const scale = currentDistance / this.lastTouchDistance;
                const newZoom = Math.max(0.5, Math.min(3, this.currentZoom * scale));
                
                // Calculate zoom center offset
                const zoomCenterX = currentCenter.x - this.currentPanX;
                const zoomCenterY = currentCenter.y - this.currentPanY;
                
                // Apply zoom with center point
                this.currentZoom = newZoom;
                this.currentPanX = currentCenter.x - zoomCenterX * (newZoom / this.currentZoom);
                this.currentPanY = currentCenter.y - zoomCenterY * (newZoom / this.currentZoom);
                
                this.updateTransform();
            }
            
            this.lastTouchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
        } else if (this.isDragging && this.touches.length === 1) {
            // Handle single touch panning
            const touch = this.touches[0];
            this.currentPanX = touch.clientX - this.dragStart.x;
            this.currentPanY = touch.clientY - this.dragStart.y;
            this.updateTransform();
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.touches = Array.from(e.touches);
        
        if (this.touches.length === 0) {
            // All touches ended
            this.isDragging = false;
            this.isPinching = false;
            this.lastTouchDistance = 0;
        } else if (this.touches.length === 1 && this.isPinching) {
            // Pinch ended, switch to single touch panning
            this.isPinching = false;
            this.isDragging = true;
            this.dragStart = { 
                x: this.touches[0].clientX - this.currentPanX, 
                y: this.touches[0].clientY - this.currentPanY 
            };
        }
    }

    // Helper methods for touch calculations
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchCenter(touch1, touch2) {
        return {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
        };
    }

    // Function to get seat color based on status
    getSeatColor(status) {
        switch(status) {
            case 'active': return '#4CAF50';     // green
            case 'pending': return '#FFD700';    // yellow
            case 'reserved': return '#FF4C4C';   // red
            case 'prebooked': return '#FF4C4C';  // red (same as reserved)
            default: return '#4CAF50';           // green (default to available for undefined statuses)
        }
    }

    // Function to get seat class based on status
    getSeatClass(status) {
        switch(status) {
            case 'available':
            case 'active': return 'available';
            case 'pending': return 'pending';
            case 'reserved':
            case 'confirmed': return 'reserved';
            case 'prebooked': return 'prebooked';
            default: return 'available'; // Default to available for undefined statuses
        }
    }

    // Function to get status text for display
    getStatusText(status) {
        const statusMap = {
            'active': 'Available',
            'available': 'Available',
            'pending': 'Pending',
            'reserved': 'Booked (Paid)',
            'confirmed': 'Booked (Paid)',
            'paid': 'Booked (Paid)',
            'Оплачен': 'Booked (Paid)',
            'prebooked': 'Booked (Paid)',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || 'Available'; // Default to Available for undefined statuses
    }

    updateSeatDisplay() {
        document.querySelectorAll('.seat').forEach(seatElement => {
            const seatId = seatElement.dataset.seatId;
            
            // Reset classes
            seatElement.className = 'seat';
            
            if (this.bookedSeats.has(seatId)) {
                seatElement.classList.add('reserved');
                // Apply red color for reserved seats
                seatElement.style.backgroundColor = '#FF4C4C';
                seatElement.style.borderColor = '#FF4C4C';
                seatElement.style.color = 'white';
            } else if (this.prebookedSeats.has(seatId)) {
                seatElement.classList.add('pending');
                // Apply yellow color for pending seats
                seatElement.style.backgroundColor = '#FFD700';
                seatElement.style.borderColor = '#FFD700';
                seatElement.style.color = '#212529';
            } else if (this.pendingSeats.has(seatId)) {
                seatElement.classList.add('pending');
                // Apply yellow color for pending seats
                seatElement.style.backgroundColor = '#FFD700';
                seatElement.style.borderColor = '#FFD700';
                seatElement.style.color = '#212529';
            } else if (this.selectedSeats.has(seatId)) {
                seatElement.classList.add('selected');
                // Apply blue color for selected seats
                seatElement.style.backgroundColor = '#007bff';
                seatElement.style.borderColor = '#007bff';
                seatElement.style.color = 'white';
            } else {
                seatElement.classList.add('available');
                // Apply green color for available seats
                seatElement.style.backgroundColor = '#4CAF50';
                seatElement.style.borderColor = '#4CAF50';
                seatElement.style.color = 'white';
            }
        });
    }

    // Enhanced seat display with status-based coloring
    updateSeatDisplayWithStatus(seatData = {}) {
        document.querySelectorAll('.seat').forEach(seatElement => {
            const seatId = seatElement.dataset.seatId;
            
            // Reset classes
            seatElement.className = 'seat';
            
            // Get status from seat data or fallback to local state
            let status = 'active'; // default
            
            if (this.bookedSeats.has(seatId)) {
                status = 'reserved';
            } else if (this.prebookedSeats.has(seatId)) {
                status = 'pending';
            } else if (this.pendingSeats.has(seatId)) {
                status = 'pending';
            } else if (this.selectedSeats.has(seatId)) {
                seatElement.classList.add('selected');
                return; // Don't override selected state
            }
            
            // Apply status-based class
            const statusClass = this.getSeatClass(status);
            seatElement.classList.add(statusClass);
            
            // Apply color directly if needed
            const color = this.getSeatColor(status);
            seatElement.style.backgroundColor = color;
            seatElement.style.borderColor = color;
        });
    }

    // Method to update seat status from external data (e.g., server response)
    updateSeatStatus(seatId, status) {
        const seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (!seatElement) {
            console.warn(`⚠️ Seat element not found for seatId: ${seatId}`);
            return;
        }

        // Don't override seats that are currently being booked
        if (this.currentBookingSeat === seatId) {
            console.log(`⏸️ Skipping update for current booking seat: ${seatId}`);
            return; // Don't interfere with current booking process
        }

        // Reset classes
        seatElement.className = 'seat';
        
        // Don't override selected state
        if (this.selectedSeats.has(seatId)) {
            seatElement.classList.add('selected');
            seatElement.style.backgroundColor = '#007bff';
            seatElement.style.borderColor = '#007bff';
            seatElement.style.color = 'white';
            console.log(`🔵 Seat ${seatId} is selected, keeping blue color`);
            return;
        }

        // Apply status-based styling
        const statusClass = this.getSeatClass(status);
        seatElement.classList.add(statusClass);
        
        // Get seat number from dataset
        const seatNumber = seatElement.dataset.seat;
        
        // Always show seat number
        seatElement.textContent = seatNumber;
        
        // Apply appropriate color based on status - explicit mapping
        if (status === 'reserved' || status === 'confirmed' || status === 'paid' || status === 'Оплачен') {
            // RED for reserved/confirmed/paid seats
            seatElement.style.backgroundColor = '#FF4C4C';
            seatElement.style.borderColor = '#FF4C4C';
            seatElement.style.color = 'white';
            seatElement.title = `${this.getStatusText(status)} - Not available for booking`;
            console.log(`🔴 Seat ${seatId} set to RED (reserved/confirmed)`);
        } else if (status === 'pending') {
            // YELLOW for pending seats
            seatElement.style.backgroundColor = '#FFD700';
            seatElement.style.borderColor = '#FFD700';
            seatElement.style.color = '#212529';
            seatElement.title = `${this.getStatusText(status)} - Not available for booking`;
            console.log(`🟡 Seat ${seatId} set to YELLOW (pending)`);
        } else if (status === 'prebooked') {
            // RED for pre-booked seats (same as reserved)
            seatElement.style.backgroundColor = '#FF4C4C';
            seatElement.style.borderColor = '#FF4C4C';
            seatElement.style.color = 'white';
            seatElement.title = `${this.getStatusText(status)} - Not available for booking`;
            console.log(`🔴 Seat ${seatId} set to RED (pre-booked)`);
        } else if (status === 'available' || status === 'active') {
            // GREEN for available/active seats
            seatElement.style.backgroundColor = '#4CAF50';
            seatElement.style.borderColor = '#4CAF50';
            seatElement.style.color = 'white';
            seatElement.title = `${this.getStatusText(status)} - Click to book`;
            console.log(`🟢 Seat ${seatId} set to GREEN (available/active)`);
        } else {
            // Default to green for unknown statuses
            seatElement.style.backgroundColor = '#4CAF50';
            seatElement.style.borderColor = '#4CAF50';
            seatElement.style.color = 'white';
            seatElement.title = `${this.getStatusText(status)} - Click to book`;
            console.log(`🟢 Seat ${seatId} set to GREEN (default for status: ${status})`);
        }
        
        // Update local state based on status
        if (status === 'reserved' || status === 'confirmed' || status === 'paid' || status === 'Оплачен') {
            this.bookedSeats.add(seatId);
            this.pendingSeats.delete(seatId);
            this.prebookedSeats.delete(seatId);
        } else if (status === 'pending') {
            this.pendingSeats.add(seatId);
            this.bookedSeats.delete(seatId);
            this.prebookedSeats.delete(seatId);
        } else if (status === 'prebooked') {
            this.prebookedSeats.add(seatId);
            this.bookedSeats.delete(seatId);
            this.pendingSeats.delete(seatId);
        } else if (status === 'available' || status === 'active') {
            this.bookedSeats.delete(seatId);
            this.pendingSeats.delete(seatId);
            this.prebookedSeats.delete(seatId);
        }
        
        // Update statistics
        this.updateStatistics();
    }

    // Method to update multiple seats from server data
    updateSeatsFromServer(seatsData) {
        if (!seatsData || !Array.isArray(seatsData)) {
            console.warn('Invalid seat data received from server:', seatsData);
            return;
        }
        
        console.log('Updating seats from server:', seatsData.length, 'seats');
        
        // Update all seats with their current status from server
        seatsData.forEach(seatInfo => {
            if (seatInfo && seatInfo.table && seatInfo.seat && seatInfo.status) {
                const seatId = `${seatInfo.table}-${seatInfo.seat}`;
                this.updateSeatStatus(seatId, seatInfo.status);
            }
        });
        
        // Update statistics after all seats are updated
        this.updateStatistics();
    }

    updateStatistics() {
        const bookings = this.getBookings();
        const totalBookings = Object.keys(bookings).length;
        const pendingBookings = Object.values(bookings).filter(b => b.status === 'pending').length;
        const confirmedBookings = Object.values(bookings).filter(b => b.status === 'paid').length;
        const availableSeats = this.totalSeats - this.bookedSeats.size - this.prebookedSeats.size;

        // Update statistics if elements exist (for admin panel)
        const totalBookingsEl = document.getElementById('totalBookings');
        const pendingPaymentsEl = document.getElementById('pendingPayments');
        const confirmedPaymentsEl = document.getElementById('confirmedPayments');
        const availableSeatsEl = document.getElementById('availableSeats');

        if (totalBookingsEl) totalBookingsEl.textContent = totalBookings;
        if (pendingPaymentsEl) pendingPaymentsEl.textContent = pendingBookings;
        if (confirmedPaymentsEl) confirmedPaymentsEl.textContent = confirmedBookings;
        if (availableSeatsEl) availableSeatsEl.textContent = availableSeats;
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        modal.style.display = 'flex';
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        modal.style.display = 'none';
    }

    saveData() {
        const data = {
            bookedSeats: Array.from(this.bookedSeats),
            prebookedSeats: Array.from(this.prebookedSeats),
            pendingSeats: Array.from(this.pendingSeats),
            selectedSeats: Array.from(this.selectedSeats)
        };
        localStorage.setItem('zolotayaSeredinaData', JSON.stringify(data));
    }

    loadSavedData() {
        const saved = localStorage.getItem('zolotayaSeredinaData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.bookedSeats = new Set(data.bookedSeats || []);
                this.prebookedSeats = new Set(data.prebookedSeats || []);
                this.pendingSeats = new Set(data.pendingSeats || []);
                this.selectedSeats = new Set(data.selectedSeats || []);
                
                this.updateSeatDisplay();
                this.updateBookingSummary();
            } catch (e) {
                console.error('Error loading saved data:', e);
            }
        }
    }

    // Socket.IO initialization for real-time updates
    initializeSocket() {
        try {
            // Connection status tracking
            this.socketStatus = {
                connected: false,
                lastConnectTime: null,
                lastDisconnectTime: null,
                totalUpdates: 0,
                lastUpdateTime: null,
                connectionAttempts: 0,
                maxConnectionAttempts: 10
            };
            
            // Initialize Socket.IO with dynamic URL for production compatibility
            const socketUrl = window.location.origin;
            console.log('🔌 Initializing Socket.IO connection to', socketUrl, '...');
            this.socket = io(socketUrl, {
                transports: ['websocket', 'polling'],
                timeout: 20000,
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                maxReconnectionAttempts: 10,
                autoConnect: true
            });
            
            // Make socket globally accessible for testing
            window.socket = this.socket;
            window.studentSystem = this;
            
            console.log('🔌 Socket.IO client initialized');
            console.log('📊 Socket available:', !!this.socket);
            console.log('🌐 Target URL: http://localhost:3000');

            // Connection event handlers
            this.socket.on('connect', () => {
                this.socketStatus.connected = true;
                this.socketStatus.lastConnectTime = new Date().toISOString();
                this.socketStatus.connectionAttempts = 0;
                
                console.log('✅ Connected to server via Socket.IO');
                console.log('🔗 Socket ID:', this.socket.id);
                console.log('🌐 Server URL: http://localhost:3000');
                console.log('🚀 Transport:', this.socket.io.engine.transport.name);
                console.log('📊 Connection status:', this.socketStatus);
                
                // Stop fallback polling if it's running
                this.stopRealTimeUpdates();
                
                // Show connection status in UI
                this.showConnectionStatus('connected');
                
                // Request initial seat data
                this.requestInitialSeatData();
            });
            
            // Handle server connection confirmation
            this.socket.on('connected', (data) => {
                console.log('🎉 Server connection confirmed:', data);
                this.showConnectionStatus('connected');
            });
            
            // Handle pong responses
            this.socket.on('pong', (data) => {
                console.log('🏓 Pong received:', data);
            });
            
            this.socket.on('disconnect', (reason) => {
                this.socketStatus.connected = false;
                this.socketStatus.lastDisconnectTime = new Date().toISOString();
                console.log('❌ Disconnected from server. Reason:', reason);
                console.log('📊 Connection status:', this.socketStatus);
                
                // Show connection status in UI
                this.showConnectionStatus('disconnected');
                
                // Start fallback polling if not reconnecting
                if (reason !== 'io client disconnect') {
                    console.log('🔄 Starting fallback polling due to disconnect...');
                    this.startRealTimeUpdates();
                }
            });
            
            this.socket.on('seatUpdate', (data) => {
                this.socketStatus.totalUpdates++;
                this.socketStatus.lastUpdateTime = new Date().toISOString();
                console.log('📡 Received seat update from server:', data);
                console.log('📊 Total updates received:', this.socketStatus.totalUpdates);
                console.log('📊 Connection status:', this.socketStatus);
                
                // Show update notification in UI
                this.showUpdateNotification(data);
                
                // Handle the seat update immediately
                this.handleSeatUpdate(data);
                
                // Log seat status changes for debugging
                if (data.seatStatuses) {
                    console.log('📊 Seat status distribution:', data.statusCounts || 'Not provided');
                    console.log('📊 Total seats:', data.totalSeats || Object.keys(data.seatStatuses).length);
                }
            });

            this.socket.on('seatBulkUpdate', (data) => {
                this.socketStatus.totalUpdates++;
                this.socketStatus.lastUpdateTime = new Date().toISOString();
                console.log('📡 Received bulk seat update from server:', data);
                console.log('📊 Total updates received:', this.socketStatus.totalUpdates);
                console.log('📊 Update type:', data.type || 'bulk_update');
                console.log('📊 Message:', data.message || 'Bulk update received');
                
                // Show bulk update notification in UI
                this.showBulkUpdateNotification(data);
                
                // Handle the bulk seat update immediately
                this.handleBulkSeatUpdate(data);
                
                // Log bulk update details for debugging
                if (data.seatStatuses) {
                    console.log('📊 Bulk update - Seat status distribution:', data.statusCounts || 'Not provided');
                    console.log('📊 Bulk update - Total seats:', data.totalSeats || Object.keys(data.seatStatuses).length);
                }
            });
            
            this.socket.on('connect_error', (error) => {
                this.socketStatus.connectionAttempts++;
                console.error('🚨 Socket.IO connection error:', error);
                console.log('📊 Connection attempts:', this.socketStatus.connectionAttempts);
                console.log('📊 Connection status:', this.socketStatus);
                
                // Show connection status in UI
                this.showConnectionStatus('error');
                
                // Only start fallback if max attempts reached
                if (this.socketStatus.connectionAttempts >= this.socketStatus.maxConnectionAttempts) {
                    console.log('🔄 Max connection attempts reached, falling back to HTTP polling...');
                    this.startRealTimeUpdates();
                }
            });
            
            this.socket.on('reconnect', (attemptNumber) => {
                console.log('🔄 Reconnected to server after', attemptNumber, 'attempts');
                this.socketStatus.connectionAttempts = 0;
            });
            
            this.socket.on('reconnect_error', (error) => {
                console.error('🚨 Reconnection error:', error);
                this.socketStatus.connectionAttempts++;
            });
            
            this.socket.on('reconnect_failed', () => {
                console.error('🚨 Reconnection failed, starting fallback polling...');
                this.startRealTimeUpdates();
            });
            
            // Add test event listener
            this.socket.on('test', (data) => {
                console.log('🧪 Test event received:', data);
                this.showTestNotification(data);
            });
            
        } catch (error) {
            console.error('🚨 Error initializing Socket.IO:', error);
            // Fallback to polling if Socket.IO is not available
            this.startRealTimeUpdates();
        }
    }

    // Request initial seat data from server
    async requestInitialSeatData() {
        try {
            console.log('📡 Requesting initial seat data from server...');
            
            // Try Socket.IO first if connected
            if (this.socket && this.socket.connected) {
                console.log('📡 Requesting seat data via Socket.IO...');
                this.socket.emit('requestSeatData');
                return;
            }
            
            // Fallback to HTTP request
            const response = await fetch('/api/seat-statuses', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📡 Initial seat data received via HTTP:', data);
                
                if (data.success && data.seatStatuses) {
                    this.handleSeatUpdate(data);
                    console.log('✅ Initial seat data loaded successfully');
                } else {
                    console.warn('⚠️ Invalid initial seat data received:', data);
                }
            } else {
                console.warn('❌ Failed to fetch initial seat data:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error fetching initial seat data:', error);
        }
    }

    // Handle real-time seat updates from Socket.IO
    handleSeatUpdate(data) {
        if (data.success && data.seatStatuses) {
            console.log('🔄 Updating seats from real-time data:', Object.keys(data.seatStatuses).length, 'seats');
            
            // Count status changes for logging
            const statusCounts = {};
            Object.values(data.seatStatuses).forEach(status => {
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
            console.log('📊 Seat status distribution:', statusCounts);
            
            // Update all seats with their current status
            Object.entries(data.seatStatuses).forEach(([seatId, status]) => {
                this.updateSeatStatus(seatId, status);
            });
            
            // Update statistics
            this.updateStatistics();
            this.lastUpdateTime = Date.now();
            
            console.log('✅ Seat updates completed');
        } else {
            console.warn('⚠️ Invalid seat update data received:', data);
        }
    }

    // Handle bulk seat updates from Socket.IO
    handleBulkSeatUpdate(data) {
        if (data.success && data.seatStatuses) {
            console.log('🔄 Processing bulk seat update:', Object.keys(data.seatStatuses).length, 'seats');
            console.log('📊 Update type:', data.type || 'bulk_update');
            console.log('📊 Message:', data.message || 'Bulk update received');
            
            // Use provided status counts or calculate them
            const statusCounts = data.statusCounts || {};
            if (Object.keys(statusCounts).length === 0) {
                Object.values(data.seatStatuses).forEach(status => {
                    statusCounts[status] = (statusCounts[status] || 0) + 1;
                });
            }
            console.log('📊 Bulk update - Seat status distribution:', statusCounts);
            
            // Update all seats with their current status
            Object.entries(data.seatStatuses).forEach(([seatId, status]) => {
                this.updateSeatStatus(seatId, status);
            });
            
            // Update statistics
            this.updateStatistics();
            this.lastUpdateTime = Date.now();
            
            console.log('✅ Bulk seat update completed');
        } else {
            console.warn('⚠️ Invalid bulk seat update data received:', data);
        }
    }

    // Show connection status in UI
    showConnectionStatus(status) {
        // Create or update connection status indicator
        let statusDiv = document.getElementById('socketStatus');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'socketStatus';
            statusDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 10px 15px;
                border-radius: 5px;
                color: white;
                font-weight: bold;
                z-index: 10000;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(statusDiv);
        }

        const statusText = {
            'connected': '🟢 Socket.IO Connected',
            'disconnected': '🔴 Socket.IO Disconnected',
            'error': '⚠️ Socket.IO Error'
        };

        const statusColors = {
            'connected': '#4CAF50',
            'disconnected': '#f44336',
            'error': '#ff9800'
        };

        statusDiv.textContent = statusText[status] || '❓ Unknown Status';
        statusDiv.style.backgroundColor = statusColors[status] || '#666';

        // Auto-hide after 3 seconds for connected status
        if (status === 'connected') {
            setTimeout(() => {
                if (statusDiv) statusDiv.style.opacity = '0.7';
            }, 3000);
        }
    }

    // Show update notification in UI
    showUpdateNotification(data) {
        const seatCount = data.seatStatuses ? Object.keys(data.seatStatuses).length : 0;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`🔔 UI Notification: Received ${seatCount} seat updates at ${timestamp}`);
        
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            background: #2196F3;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div>📡 Real-time Update</div>
            <div>${seatCount} seats updated</div>
            <div>${timestamp}</div>
        `;
        
        // Add CSS animation
        if (!document.getElementById('notificationStyle')) {
            const style = document.createElement('style');
            style.id = 'notificationStyle';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 2 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }

    // Show bulk update notification
    showBulkUpdateNotification(data) {
        const seatCount = data.seatStatuses ? Object.keys(data.seatStatuses).length : 0;
        const timestamp = new Date().toLocaleTimeString();
        const updateType = data.type || 'bulk_update';
        const message = data.message || 'Bulk update received';
        
        console.log(`🔔 UI Notification: Received bulk update - ${seatCount} seats at ${timestamp}`);
        console.log(`📊 Update type: ${updateType}, Message: ${message}`);
        
        // Create temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            background: #FF9800;
            color: white;
            padding: 12px 18px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 9999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            border-left: 4px solid #F57C00;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold;">🔄 Bulk Update</div>
            <div>${seatCount} seats updated</div>
            <div style="font-size: 11px; opacity: 0.9;">${message}</div>
            <div style="font-size: 11px; opacity: 0.8;">${timestamp}</div>
        `;
        
        // Add CSS animation
        if (!document.getElementById('notificationStyle')) {
            const style = document.createElement('style');
            style.id = 'notificationStyle';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 4 seconds (longer for bulk updates)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);
    }

    // Show test notification
    showTestNotification(data) {
        console.log('🧪 Test notification received:', data);
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 120px;
            right: 10px;
            background: #9C27B0;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        
        notification.innerHTML = `
            <div>🧪 Test Event</div>
            <div>${data.message || 'Test message received'}</div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Test Socket.IO connection
    testSocketConnection() {
        console.log('🧪 Testing Socket.IO connection...');
        console.log('📊 Current connection status:', this.socketStatus);
        
        if (this.socket) {
            console.log('🔌 Socket object exists');
            console.log('📊 Socket connected:', this.socket.connected);
            console.log('🔗 Socket ID:', this.socket.id);
            console.log('🌐 Socket URL:', this.socket.io.uri);
            
            if (this.socket.connected) {
                console.log('✅ Socket is connected, sending test event...');
                this.socket.emit('test', { 
                    message: 'Test from student client',
                    timestamp: new Date().toISOString(),
                    clientId: this.socket.id
                });
                
                // Also request seat data
                console.log('📡 Requesting current seat data...');
                this.socket.emit('requestSeatData');
            } else {
                console.log('❌ Socket is not connected, attempting to connect...');
                this.socket.connect();
            }
        } else {
            console.log('❌ Socket object not found, reinitializing...');
            this.initializeSocket();
        }
    }

    // Get connection diagnostics
    getConnectionDiagnostics() {
        const diagnostics = {
            socketAvailable: !!this.socket,
            socketConnected: this.socket ? this.socket.connected : false,
            socketId: this.socket ? this.socket.id : null,
            status: this.socketStatus,
            fallbackActive: !!this.realTimeUpdateInterval,
            lastUpdate: this.lastUpdateTime ? new Date(this.lastUpdateTime).toLocaleString() : 'Never'
        };
        
        console.log('🔍 Socket.IO Diagnostics:', diagnostics);
        
        // Update test panel display
        const testStatus = document.getElementById('testStatus');
        if (testStatus) {
            testStatus.innerHTML = `
Socket.IO Diagnostics:
• Socket Available: ${diagnostics.socketAvailable}
• Socket Connected: ${diagnostics.socketConnected}
• Socket ID: ${diagnostics.socketId || 'N/A'}
• Total Updates: ${diagnostics.status.totalUpdates}
• Last Update: ${diagnostics.lastUpdate}
• Fallback Active: ${diagnostics.fallbackActive}
• Last Connect: ${diagnostics.status.lastConnectTime || 'Never'}
• Last Disconnect: ${diagnostics.status.lastDisconnectTime || 'Never'}
            `;
        }
        
        return diagnostics;
    }

    // Force seat update (for testing)
    async forceSeatUpdate() {
        console.log('🔄 Forcing seat update...');
        
        try {
            const response = await fetch('/api/seat-statuses', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📡 Forced seat update response:', data);
                
                if (data.success && data.seatStatuses) {
                    // Simulate Socket.IO update
                    this.handleSeatUpdate(data);
                    
                    // Show notification
                    this.showUpdateNotification(data);
                    
                    console.log('✅ Forced seat update completed');
                } else {
                    console.warn('⚠️ Invalid response from seat-statuses API:', data);
                }
            } else {
                console.warn('❌ Failed to fetch seat statuses:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error forcing seat update:', error);
        }
    }

    // Trigger server-side seat update (for testing)
    async triggerServerUpdate() {
        console.log('🚀 Triggering server-side seat update...');
        
        try {
            const response = await fetch('/api/test/emit-seat-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📡 Server update response:', data);
                
                // Show notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 180px;
                    right: 10px;
                    background: #ff9800;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 5px;
                    font-size: 12px;
                    z-index: 9999;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                `;
                
                notification.innerHTML = `
                    <div>🚀 Server Update Triggered</div>
                    <div>${data.message}</div>
                `;
                
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 3000);
                
                console.log('✅ Server update triggered successfully');
            } else {
                console.warn('❌ Failed to trigger server update:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('❌ Error triggering server update:', error);
        }
    }

    // Reconnect Socket.IO connection
    reconnectSocket() {
        console.log('🔌 Reconnecting Socket.IO...');
        
        // Disconnect existing socket if any
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        // Stop fallback polling
        this.stopRealTimeUpdates();
        
        // Reset connection status
        this.socketStatus = {
            connected: false,
            lastConnectTime: null,
            lastDisconnectTime: null,
            totalUpdates: 0,
            lastUpdateTime: null,
            connectionAttempts: 0,
            maxConnectionAttempts: 5
        };
        
        // Show reconnecting status
        this.showConnectionStatus('error');
        
        // Reinitialize socket after a short delay
        setTimeout(() => {
            console.log('🔄 Reinitializing Socket.IO connection...');
            this.initializeSocket();
        }, 1000);
    }

    // Real-time updates functionality (fallback polling)
    startRealTimeUpdates() {
        // Clear existing interval
        if (this.realTimeUpdateInterval) {
            clearInterval(this.realTimeUpdateInterval);
        }
        
        // Start polling for updates every 5 seconds as fallback
        this.realTimeUpdateInterval = setInterval(() => {
            this.checkForSeatUpdates();
        }, 5000);
        
        console.log('Real-time seat updates started (polling every 5 seconds)');
    }

    stopRealTimeUpdates() {
        if (this.realTimeUpdateInterval) {
            clearInterval(this.realTimeUpdateInterval);
            this.realTimeUpdateInterval = null;
        }
        console.log('Real-time seat updates stopped');
    }


    // Handle seat click/touch for booking
    handleSeatClick(seatElement, event) {
        try {
            const table = parseInt(seatElement.dataset.table);
            const seat = parseInt(seatElement.dataset.seat);
            const seatId = `${table}-${seat}`;
            
            console.log(`🪑 Seat clicked: Table ${table}, Seat ${seat} (${seatId})`);
            
            // Prevent default behavior to avoid layout shifts
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            // Check if seat is available for booking
            if (seatElement.classList.contains('booked') || 
                seatElement.classList.contains('reserved') ||
                seatElement.classList.contains('prebooked') ||
                seatElement.classList.contains('pending')) {
                console.log('❌ Seat is not available for booking');
                this.showSeatStatusModal(table, seat, seatElement.classList);
                return;
            }
            
            // If seat is available, open booking modal immediately
            if (seatElement.classList.contains('available') || seatElement.classList.contains('active')) {
                console.log(`✅ Opening booking modal for seat: ${seatId}`);
                this.showBookingModal(seatId);
                return;
            }
            
            // For any other status, show status modal
            this.showSeatStatusModal(table, seat, seatElement.classList);
            
        } catch (error) {
            console.error('❌ Error handling seat click:', error);
        }
    }
    
    // Show seat status modal for unavailable seats
    showSeatStatusModal(table, seat, classList) {
        let status = 'Available';
        let message = 'Это место доступно для бронирования.';
        
        if (classList.contains('booked')) {
            status = 'Забронировано';
            message = 'Это место уже забронировано и оплачено.';
        } else if (classList.contains('prebooked')) {
            status = 'Предварительно забронировано';
            message = 'Это место предварительно забронировано администратором.';
        } else if (classList.contains('pending')) {
            status = 'Ожидает оплаты';
            message = 'Это место забронировано, но еще не оплачено.';
        }
        
        // Create and show modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Место ${table}-${seat}</h3>
                <p><strong>Статус:</strong> ${status}</p>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="this.closest('.modal').remove()">ОК</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 3000);
    }
    
    // Update booking summary
    updateBookingSummary() {
        const selectedCount = this.selectedSeats.size;
        const totalPrice = selectedCount * this.ticketPrice;
        
        // Update summary display if elements exist
        const selectedCountEl = document.getElementById('selectedCount');
        const totalPriceEl = document.getElementById('totalPrice');
        const bookNowBtn = document.getElementById('bookNowBtn');
        
        if (selectedCountEl) selectedCountEl.textContent = selectedCount;
        if (totalPriceEl) totalPriceEl.textContent = totalPrice.toLocaleString();
        
        // Enable/disable book now button
        if (bookNowBtn) {
            bookNowBtn.disabled = selectedCount === 0;
            bookNowBtn.textContent = selectedCount > 0 ? 
                `Забронировать ${selectedCount} мест` : 'Выберите места';
        }
        
        console.log(`📊 Booking summary updated: ${selectedCount} seats, ${totalPrice} сом`);
    }

    // Update individual seat status and appearance

    // Update seats from Socket.IO data
    updateSeatsFromSocketData(seatStatuses) {
        try {
            console.log('🔄 Updating seats from Socket.IO data...');
            
            // Clear existing seat states
            this.bookedSeats.clear();
            this.prebookedSeats.clear();
            this.pendingSeats.clear();
            
            // Update seat statuses based on server data
            Object.entries(seatStatuses).forEach(([seatId, status]) => {
                const [table, seat] = seatId.split('-').map(Number);
                const seatElement = document.querySelector(`[data-table="${table}"][data-seat="${seat}"]`);
                
                if (seatElement) {
                    // Remove all status classes
                    seatElement.classList.remove('booked', 'prebooked', 'pending', 'available', 'active', 'reserved');
                    
                    // Add appropriate class and update sets
                    switch (status) {
                        case 'reserved':
                        case 'paid':
                            seatElement.classList.add('booked');
                            this.bookedSeats.add(seatId);
                            break;
                        case 'pending':
                            seatElement.classList.add('pending');
                            this.pendingSeats.add(seatId);
                            break;
                        case 'prebooked':
                            seatElement.classList.add('prebooked');
                            this.prebookedSeats.add(seatId);
                            break;
                        case 'active':
                        default:
                            seatElement.classList.add('available');
                            break;
                    }
                    
                    // Update seat text and color
                    const seatId = `${table}-${seat}`;
                    this.updateSeatStatus(seatId, status);
                }
            });
            
            // Update statistics
            this.updateStatistics();
            
            console.log('✅ Seats updated from Socket.IO data');
            console.log('📊 Current status:', {
                booked: this.bookedSeats.size,
                pending: this.pendingSeats.size,
                prebooked: this.prebookedSeats.size,
                available: this.totalSeats - this.bookedSeats.size - this.pendingSeats.size - this.prebookedSeats.size
            });
            
        } catch (error) {
            console.error('❌ Error updating seats from Socket.IO data:', error);
        }
    }

    async checkForSeatUpdates() {
        try {
            // Fetch current seat statuses from server
            const response = await fetch('/api/seat-statuses', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    this.updateSeatsFromServer(data.data);
                    this.lastUpdateTime = Date.now();
                } else {
                    console.warn('Invalid response from seat-statuses API:', data);
                }
            } else {
                console.warn('Failed to fetch seat statuses:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error checking for seat updates:', error);
            // Don't show error to user as this is a background operation
        }
    }


}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StudentTicketingSystem();
});

// Touch support is now handled by the StudentTicketingSystem class
// The global touch handlers are removed to allow proper pinch-to-zoom functionality