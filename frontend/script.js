// Safe DOM text setter helper function
function setTextSafe(selectorOrEl, text, options = {}) {
    const { show = true, createFallback = true } = options;
    
    try {
        let element;
        
        if (typeof selectorOrEl === 'string') {
            element = document.querySelector(selectorOrEl);
        } else {
            element = selectorOrEl;
        }
        
        if (element) {
            element.textContent = text;
            if (show && element.style) {
                element.style.display = 'block';
            }
            return true;
        } else if (createFallback) {
            // Create fallback element if it doesn't exist
            const fallbackId = selectorOrEl.replace('#', '') || 'fallback-error';
            const fallback = document.createElement('div');
            fallback.id = fallbackId;
            fallback.className = 'alert alert-error';
            fallback.setAttribute('role', 'alert');
            fallback.setAttribute('aria-live', 'polite');
            fallback.style.display = show ? 'block' : 'none';
            fallback.textContent = text;
            
            // Try to append to body or a container
            const container = document.querySelector('.container') || document.body;
            if (container) {
                container.appendChild(fallback);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error in setTextSafe:', error);
        return false;
    }
}

// Main Ticketing System for Students
class StudentTicketingSystem {
    constructor() {
        this.totalTables = 36;
        this.seatsPerTable = 14;
        this.totalSeats = this.totalTables * this.seatsPerTable;
        this.ticketPrice = 5500;
        this.selectedSeats = new Set();
        this.bookedSeats = new Set();
        this.prebookedSeats = new Set();
        this.pendingSeats = new Set();
        
        this.currentBookingSeat = null;
        this.tempBookingData = null;
        this.modalReadyForSubmission = false; // Store temporary booking data before payment
        this.isSubmitting = false; // Prevent duplicate form submissions
        this.realTimeUpdateInterval = null;
        this.lastUpdateTime = Date.now();
        this.socket = null;
        
        // Touch handling for mobile seat selection
        this.touchStartTime = 0;
        this.touchStartPosition = { x: 0, y: 0 };
        this.dragThreshold = 10; // pixels of movement before considering it a drag
        this.touchedSeat = null; // Track which seat was touched
        this.pointerDownSeat = null; // Track which seat had pointer down
        this.pointerStartTime = 0;
        this.pointerStartPosition = { x: 0, y: 0 };
        
        // Cooldown for preventing accidental taps after gestures
        this.ignoreTapUntil = 0;
        
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
        
        
        // Debug: Validation testing removed to prevent automatic alerts
    }

    setupEventListeners() {
        // WhatsApp number input handling - ensure + prefix is maintained
        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                let value = e.target.value;
                // Ensure it starts with +
                if (!value.startsWith('+')) {
                    value = '+' + value.replace(/[^0-9]/g, '');
                } else {
                    // Remove any non-digit characters except the leading +
                    value = '+' + value.slice(1).replace(/[^0-9]/g, '');
                }
                e.target.value = value;
            });
            
            phoneInput.addEventListener('keydown', (e) => {
                // Prevent deleting the + symbol
                if (e.target.selectionStart <= 1 && (e.key === 'Backspace' || e.key === 'Delete')) {
                    e.preventDefault();
                }
            });
        }
        
        // Seat selection - comprehensive event support for all devices
        const tablesContainer = document.getElementById('tablesContainer');
        
        // Click events for desktop
        tablesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('seat') && Date.now() > this.ignoreTapUntil) {
                console.log('🖱️ Desktop seat click detected:', e.target);
                this.handleSeatClick(e.target, e);
            }
        });
        
        // Touch events for mobile seat selection
        tablesContainer.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('seat')) {
                console.log('📱 Mobile touch start on seat:', e.target);
                this.touchedSeat = e.target;
                this.touchStartTime = Date.now();
                this.touchStartPosition = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            }
        }, { passive: true });
        
        tablesContainer.addEventListener('touchend', (e) => {
            // Check if this is a tap on a seat (not a drag)
            if (e.target.classList.contains('seat') && this.touchedSeat === e.target) {
                const touchDuration = Date.now() - this.touchStartTime;
                const touchDistance = this.getTouchDistance(
                    { clientX: this.touchStartPosition.x, clientY: this.touchStartPosition.y },
                    { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
                );
                
                // Only handle as seat selection if it's a quick tap (not a drag) and not in cooldown
                if (touchDuration < 500 && touchDistance < this.dragThreshold && Date.now() > this.ignoreTapUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📱 Mobile seat tap detected:', e.target);
                    this.handleSeatClick(e.target, e);
                }
                this.touchedSeat = null;
            }
        }, { passive: false });
        
        // Pointer events for modern browsers (includes both mouse and touch)
        tablesContainer.addEventListener('pointerdown', (e) => {
            if (e.target.classList.contains('seat')) {
                console.log('👆 Pointer down on seat:', e.target);
                this.pointerDownSeat = e.target;
                this.pointerStartTime = Date.now();
                this.pointerStartPosition = { x: e.clientX, y: e.clientY };
            }
        });
        
        tablesContainer.addEventListener('pointerup', (e) => {
            if (e.target.classList.contains('seat') && this.pointerDownSeat === e.target) {
                const pointerDuration = Date.now() - this.pointerStartTime;
                const pointerDistance = this.getTouchDistance(
                    { clientX: this.pointerStartPosition.x, clientY: this.pointerStartPosition.y },
                    { clientX: e.clientX, clientY: e.clientY }
                );
                
                if (pointerDuration < 500 && pointerDistance < this.dragThreshold && Date.now() > this.ignoreTapUntil) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('👆 Pointer tap detected:', e.target);
                    this.handleSeatClick(e.target, e);
                }
                this.pointerDownSeat = null;
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
            
            // Prevent duplicate submissions
            if (this.isSubmitting) {
                console.log('⚠️ DEBUG: Form submission already in progress - ignoring duplicate submission');
                return;
            }
            
            // Prevent submission if no seat is selected (shouldn't happen, but safety check)
            if (!this.currentBookingSeat) {
                console.log('⚠️ DEBUG: No seat selected for booking!');
                return;
            }
            
            // Prevent premature submission (before user has time to fill form)
            if (!this.modalReadyForSubmission) {
                console.log('⚠️ DEBUG: Form submitted too early - modal not ready yet!');
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
                return;
            }
            
            // Set submission flag to prevent duplicates
            this.isSubmitting = true;
            
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

        // WhatsApp opt-in confirmation modal event listeners
        document.getElementById('confirmOptin')?.addEventListener('click', () => {
            this.confirmOptIn();
        });

        document.getElementById('resendCode')?.addEventListener('click', () => {
            this.resendConfirmationCode();
        });

        document.getElementById('closeConfirmationCodeModal')?.addEventListener('click', () => {
            this.hideModal('confirmationCodeModal');
        });

        // Initialize phone display update for opt-in text
        this.updateOptInPhoneDisplay();
    }

    generateHallLayout() {
        const container = document.getElementById('tablesContainer');
        container.innerHTML = '';

        for (let table = 1; table <= this.totalTables; table++) {
            const tableElement = this.createTable(table);
            container.appendChild(tableElement);
        }

        console.log('🏗️ Hall layout generated with', this.totalTables, 'tables');
    }

    createTable(tableNumber) {
        const tableDiv = document.createElement('div');
        tableDiv.className = 'table';

        // Table number
        const tableNumberDiv = document.createElement('div');
        tableNumberDiv.className = 'table-number';
        tableNumberDiv.textContent = `Стол ${tableNumber}`;
        tableDiv.appendChild(tableNumberDiv);

        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table';
        tableContainer.setAttribute('data-table', tableNumber);

        // Create 14 seats directly in the table grid
        for (let seat = 1; seat <= this.seatsPerTable; seat++) {
            const seatElement = document.createElement('div');
            seatElement.className = 'seat available';
            seatElement.textContent = seat;
            seatElement.dataset.table = tableNumber;
            seatElement.dataset.seat = seat;
            seatElement.dataset.seatId = `${tableNumber}-${seat}`;

            // Add seat directly to table container (CSS Grid will handle layout)
            tableContainer.appendChild(seatElement);
        }

        tableDiv.appendChild(tableContainer);

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
        this.isSubmitting = false; // Reset submission flag for new booking
        
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
        // Email input removed - phone-only authentication
        
        console.log('🔍 DEBUG: Input elements:');
        console.log('  firstName:', firstNameInput?.value);
        console.log('  lastName:', lastNameInput?.value);
        console.log('  phone:', phoneInput?.value);
        // Email removed - phone-only authentication
        
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
            whatsappOptin: formData.get('whatsappOptin') === 'on',
            // email removed - phone-only authentication
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
            this.isSubmitting = false; // Reset flag on validation failure
            return;
        }

        try {
            // Handle WhatsApp opt-in if checked
            if (bookingData.whatsappOptin) {
                await this.handleWhatsAppOptIn(bookingData);
            }
            
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
        } finally {
            // Always reset the submission flag
            this.isSubmitting = false;
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
            setTextSafe('#paymentError .error-message', 'Нет данных для подтверждения оплаты');
            setTextSafe('#paymentError', '', { show: true });
            return;
        }

        try {
            console.log('💳 Processing payment confirmation...');
            
            // Hide any existing error messages
            setTextSafe('#paymentError', '', { show: false });
            
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
            
            // Log error to backend if possible
            this.logClientError('payment_confirmation_error', error.message, error.stack);
            
            // Show user-friendly error message
            const errorMessage = `Ошибка при подтверждении оплаты: ${error.message}`;
            setTextSafe('#paymentError .error-message', errorMessage);
            setTextSafe('#paymentError', '', { show: true });
            
            // Auto-hide error after 10 seconds
            setTimeout(() => {
                setTextSafe('#paymentError', '', { show: false });
            }, 10000);
        }
    }

    // Retry payment confirmation
    retryPaymentConfirmation() {
        setTextSafe('#paymentError', '', { show: false });
        this.handlePaymentConfirmation();
    }

    // Log client errors to backend
    async logClientError(errorType, message, stack) {
        try {
            await fetch('/api/log-client-error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    errorType,
                    message,
                    stack,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (logError) {
            console.warn('Failed to log client error to backend:', logError);
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
            // email removed - phone-only authentication
        });

        if (!data.firstName || !data.firstName?.trim()) errors.push('Имя обязательно');
        if (!data.lastName || !data.lastName?.trim()) errors.push('Фамилия обязательна');
        if (!data.phone || !data.phone?.trim()) errors.push('Телефон обязателен');
        // Email validation removed - phone-only authentication

        // WhatsApp number validation (E.164 format)
        const phoneRegex = /^\+\d{10,15}$/;
        if (data.phone && !phoneRegex.test(data.phone)) {
            errors.push('Please enter a valid WhatsApp number starting with + and containing 10-15 digits (e.g., +1234567890)');
        }

        // Duplicate phone validation removed

        if (errors.length > 0) {
            alert('Пожалуйста, проверьте данные:\n' + errors.join('\n'));
            return false;
        }

        return true;
    }

    // Test function removed - was causing automatic validation alerts on page load


    // Emit seat selection update to all clients
    emitSeatSelection(seatId, status) {
        if (this.socket && this.socket.connected) {
            console.log(`📡 Emitting seat selection: ${seatId} -> ${status}`);
            this.socket.emit('seatSelection', {
                seatId: seatId,
                status: status,
                timestamp: Date.now(),
                clientId: this.socket.id
            });
        } else {
            console.warn('❌ Socket not connected, cannot emit seat selection');
        }
    }

    // Update seat status from real-time selection events
    updateSeatStatusFromSelection(seatId, status) {
        console.log(`🔄 Updating seat ${seatId} to ${status} from real-time selection`);
        
        const seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (seatElement) {
            // Update the seat class based on status
            seatElement.className = 'seat';
            
            if (status === 'selected') {
                seatElement.classList.add('selected');
                seatElement.style.backgroundColor = '#007bff';
                seatElement.style.borderColor = '#007bff';
                seatElement.style.color = 'white';
            } else if (status === 'available') {
                seatElement.classList.add('available');
                seatElement.style.backgroundColor = '#4CAF50';
                seatElement.style.borderColor = '#4CAF50';
                seatElement.style.color = 'white';
            }
            
            console.log(`✅ Seat ${seatId} updated to ${status}`);
        } else {
            console.warn(`⚠️ Seat element not found for ${seatId}`);
        }
    }

    // Helper methods for touch gestures
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

    // New helper methods for proper pinch-to-zoom
    getDistanceAndMidpoint(touches) {
        const x1 = touches[0].clientX, y1 = touches[0].clientY;
        const x2 = touches[1].clientX, y2 = touches[1].clientY;
        const dx = x1 - x2, dy = y1 - y2;
        const distance = Math.hypot(dx, dy);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        return { distance, midX, midY };
    }

    screenToElementCoords(x, y, el) {
        const rect = el.getBoundingClientRect();
        return { ex: x - rect.left, ey: y - rect.top };
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

            // Handle update-seat-status events (same as seatUpdate but with different event name)
            this.socket.on('update-seat-status', (data) => {
                this.socketStatus.totalUpdates++;
                this.socketStatus.lastUpdateTime = new Date().toISOString();
                console.log('📡 Received update-seat-status from server:', data);
                console.log('📊 Total updates received:', this.socketStatus.totalUpdates);
                
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
            
            // Handle seat selection events from other clients
            this.socket.on('seatSelection', (data) => {
                console.log('📡 Received seat selection from another client:', data);
                
                // Don't process our own seat selections
                if (data.fromClient === this.socket.id) {
                    console.log('🔄 Ignoring own seat selection event');
                    return;
                }
                
                // Update the seat status immediately
                this.updateSeatStatusFromSelection(data.seatId, data.status);
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
            
            // Check if seat is available for booking - check both classes and data-status
            const seatStatus = seatElement.dataset.status || 'active';
            const isUnavailable = seatElement.classList.contains('booked') || 
                seatElement.classList.contains('reserved') ||
                seatElement.classList.contains('prebooked') ||
                seatElement.classList.contains('pending') ||
                seatStatus === 'booked' ||
                seatStatus === 'reserved' ||
                seatStatus === 'paid' ||
                seatStatus === 'pending';
                
            if (isUnavailable) {
                console.log('❌ Seat is not available for booking, status:', seatStatus);
                this.showSeatStatusModal(table, seat, seatElement.classList);
                return;
            }
            
            // If seat is available, open booking modal immediately
            if (seatElement.classList.contains('available') || seatElement.classList.contains('active')) {
                console.log(`✅ Opening booking modal for seat: ${seatId}`);
                
                // Emit real-time update to all clients that seat is being selected
                this.emitSeatSelection(seatId, 'selected');
                
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
        // Find the seat element to get its current status
        const seatElement = document.querySelector(`.seat[data-table="${table}"][data-seat="${seat}"]`);
        const seatStatus = seatElement ? seatElement.dataset.status : 'active';
        
        let status = 'Available';
        let message = 'Это место доступно для бронирования.';
        
        // Check data-status first (authoritative from server)
        if (seatStatus === 'booked' || seatStatus === 'reserved' || seatStatus === 'paid') {
            status = 'Забронировано';
            message = 'Это место недоступно для бронирования.';
        } else if (seatStatus === 'pending') {
            status = 'Ожидает оплаты';
            message = 'Это место недоступно для бронирования.';
        } else if (classList.contains('booked') || classList.contains('reserved')) {
            status = 'Забронировано';
            message = 'Это место недоступно для бронирования.';
        } else if (classList.contains('prebooked')) {
            status = 'Предварительно забронировано';
            message = 'Это место недоступно для бронирования.';
        } else if (classList.contains('pending')) {
            status = 'Ожидает оплаты';
            message = 'Это место недоступно для бронирования.';
        } else if (classList.contains('active') || classList.contains('available') || seatStatus === 'active') {
            status = 'Свободно';
            message = 'Это место доступно для бронирования.';
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

    // WhatsApp Opt-in Methods
    async handleWhatsAppOptIn(bookingData) {
        try {
            console.log('📱 Handling WhatsApp opt-in for:', bookingData.phone);
            
            // Update phone display in opt-in text
            document.getElementById('optinPhoneDisplay').textContent = bookingData.phone;
            
            // Call opt-in API
            const response = await fetch('/api/optin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: bookingData.firstName,
                    surname: bookingData.lastName,
                    phone: bookingData.phone,
                    optin_source: 'booking_form',
                    booking_id: null // Will be set after booking is created
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ WhatsApp opt-in initiated successfully');
                // Show confirmation modal
                this.showConfirmationCodeModal(bookingData.phone);
            } else {
                console.error('❌ WhatsApp opt-in failed:', result.error);
                this.showOptInMessage('error', 'Ошибка при отправке кода подтверждения: ' + result.error);
            }
        } catch (error) {
            console.error('❌ WhatsApp opt-in error:', error);
            this.showOptInMessage('error', 'Ошибка при обработке подписки на WhatsApp');
        }
    }

    showConfirmationCodeModal(phone) {
        document.getElementById('confirmationPhone').textContent = phone;
        document.getElementById('confirmationCode').value = '';
        document.getElementById('confirmationMessage').style.display = 'none';
        this.showModal('confirmationCodeModal');
    }

    async confirmOptIn() {
        const phone = document.getElementById('confirmationPhone').textContent;
        const code = document.getElementById('confirmationCode').value;
        
        if (!code || code.length !== 6) {
            this.showConfirmationMessage('error', 'Пожалуйста, введите 6-значный код подтверждения');
            return;
        }
        
        try {
            const response = await fetch('/api/confirm-optin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone,
                    code: code
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showConfirmationMessage('success', 'Подписка на WhatsApp подтверждена!');
                setTimeout(() => {
                    this.hideModal('confirmationCodeModal');
                }, 2000);
            } else {
                this.showConfirmationMessage('error', 'Неверный код подтверждения. Попробуйте еще раз.');
            }
        } catch (error) {
            console.error('❌ Confirm opt-in error:', error);
            this.showConfirmationMessage('error', 'Ошибка при подтверждении подписки');
        }
    }

    async resendConfirmationCode() {
        const phone = document.getElementById('confirmationPhone').textContent;
        
        try {
            const response = await fetch('/api/optin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: this.tempBookingData.firstName,
                    surname: this.tempBookingData.lastName,
                    phone: phone,
                    optin_source: 'booking_form'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showConfirmationMessage('success', 'Код подтверждения отправлен повторно');
            } else {
                this.showConfirmationMessage('error', 'Ошибка при повторной отправке кода');
            }
        } catch (error) {
            console.error('❌ Resend code error:', error);
            this.showConfirmationMessage('error', 'Ошибка при повторной отправке кода');
        }
    }

    showConfirmationMessage(type, message) {
        const messageEl = document.getElementById('confirmationMessage');
        messageEl.className = `optin-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
    }

    showOptInMessage(type, message) {
        // Create a temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `optin-message ${type}`;
        messageEl.textContent = message;
        
        // Insert after the booking form
        const form = document.getElementById('bookingForm');
        form.parentNode.insertBefore(messageEl, form.nextSibling);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 5000);
    }

    // Update phone display in opt-in text when phone input changes
    updateOptInPhoneDisplay() {
        const phoneInput = document.getElementById('phone');
        const optinPhoneDisplay = document.getElementById('optinPhoneDisplay');
        
        if (phoneInput && optinPhoneDisplay) {
            phoneInput.addEventListener('input', () => {
                optinPhoneDisplay.textContent = phoneInput.value || '+XXX';
            });
        }
    }


}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const system = new StudentTicketingSystem();
    // Initialize seating plan image zoom functionality
    initializeSeatingPlanImage();
});

// Initialize interactive seating plan with clickable table areas
function initializeSeatingPlanImage() {
    const image = document.getElementById('seatingPlanImage');
    const overlay = document.getElementById('tableOverlay');
    
    if (!image || !overlay) {
        console.warn('Seating plan image or overlay element not found');
        return;
    }

    // Add error handling for image loading
    image.addEventListener('error', (e) => {
        console.warn('Failed to load seating plan image:', e.target.src);
        console.log('Attempting to load fallback image...');
    });

    image.addEventListener('load', () => {
        console.log('Seating plan image loaded successfully:', image.src);
        createInteractiveTableAreas();
        // Cleanup any existing overlays
        cleanupTableOverlays();
    });

    // Create clickable table areas
    function createInteractiveTableAreas() {
        // Clear existing overlay
        overlay.innerHTML = '';
        
        // Get image dimensions
        const imageWidth = image.offsetWidth;
        const imageHeight = image.offsetHeight;
        
        // Define table positions (these would need to be adjusted based on your actual hall layout)
        const tablePositions = generateTablePositions(imageWidth, imageHeight);
        
        // Create clickable areas for each table
        tablePositions.forEach((pos, index) => {
            const tableArea = document.createElement('div');
            tableArea.className = 'table-area';
            tableArea.style.left = `${pos.x}%`;
            tableArea.style.top = `${pos.y}%`;
            tableArea.style.width = `${pos.width}px`;
            tableArea.style.height = `${pos.height}px`;
            // Hide seat numbers - only show table areas for selection
            // tableArea.textContent = pos.tableNumber;
            tableArea.dataset.table = pos.tableNumber;
            tableArea.dataset.seat = pos.seatNumber;
            
            // Add click handler
            tableArea.addEventListener('click', (e) => {
                e.stopPropagation();
                handleTableClick(pos.tableNumber, pos.seatNumber, tableArea);
            });
            
            overlay.appendChild(tableArea);
        });
        
        // Update table statuses based on existing bookings
        updateTableStatuses();
    }
    
    // Generate table positions (this is a simplified version - you'd need to adjust based on your actual hall layout)
    function generateTablePositions(imageWidth, imageHeight) {
        const positions = [];
        const tableSize = Math.min(imageWidth, imageHeight) * 0.03; // 3% of image size
        
        // Generate positions for 36 tables (6 rows x 6 columns)
        for (let table = 1; table <= 36; table++) {
            const row = Math.floor((table - 1) / 6);
            const col = (table - 1) % 6;
            
            // Position tables in a grid pattern
            const x = 10 + (col * 13); // 10% margin + 13% spacing
            const y = 15 + (row * 12); // 15% from top + 12% spacing
            
            positions.push({
                tableNumber: table,
                seatNumber: 1, // Default seat number
                x: x,
                y: y,
                width: tableSize,
                height: tableSize
            });
        }
        
        return positions;
    }
    
    // Handle table click
    function handleTableClick(tableNumber, seatNumber, tableElement) {
        // Removed selection overlay - no visual feedback for selected tables
        // Trigger booking for this table
        if (window.selectTable) {
            window.selectTable(tableNumber, seatNumber);
        } else {
            // Fallback: scroll to booking form
            const bookingForm = document.querySelector('.booking-form');
            if (bookingForm) {
                bookingForm.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
    
    // Update table statuses based on existing bookings
    function updateTableStatuses() {
        // Removed booked table overlays - no visual indication of booked tables
        // Table booking status is handled internally without visual overlays
    }
    
    // Cleanup function to remove any existing selected/booked overlays
    function cleanupTableOverlays() {
        document.querySelectorAll('.table-area.selected, .table-area.booked').forEach(el => {
            el.classList.remove('selected', 'booked');
            el.textContent = '';
        });
    }
    
    // Make functions available globally
    window.updateTableStatuses = updateTableStatuses;
    window.cleanupTableOverlays = cleanupTableOverlays;
    
    // Create selectTable function to integrate with existing booking system
    window.selectTable = function(tableNumber, seatNumber) {
        console.log(`🎯 Table selected from interactive plan: Table ${tableNumber}, Seat ${seatNumber}`);
        
        // Find the corresponding seat element in the existing table grid
        const seatElement = document.querySelector(`[data-table="${tableNumber}"][data-seat="${seatNumber}"]`);
        
        if (seatElement) {
            // Trigger the existing seat click handler
            if (window.studentTicketingSystem && window.studentTicketingSystem.handleSeatClick) {
                window.studentTicketingSystem.handleSeatClick(seatElement, null);
            } else {
                console.warn('Student ticketing system not available');
            }
        } else {
            console.warn(`Seat element not found for table ${tableNumber}, seat ${seatNumber}`);
            // Fallback: scroll to booking form
            const bookingForm = document.querySelector('.booking-form');
            if (bookingForm) {
                bookingForm.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    // Double-tap to zoom on mobile
    let lastTap = 0;
    image.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0) {
            e.preventDefault();
            if (isZoomed) {
                image.classList.remove('zoomed');
                isZoomed = false;
            } else {
                image.classList.add('zoomed');
                isZoomed = true;
            }
        }
        lastTap = currentTime;
    });

    // Close zoom when clicking outside
    document.addEventListener('click', (e) => {
        if (isZoomed && !image.contains(e.target)) {
            image.classList.remove('zoomed');
            isZoomed = false;
        }
    });
}

// Touch support is now handled by the StudentTicketingSystem class
// The global touch handlers are removed to allow proper pinch-to-zoom functionality