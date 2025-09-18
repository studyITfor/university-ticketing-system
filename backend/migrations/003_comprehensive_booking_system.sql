-- Migration: Comprehensive Booking System Database Schema
-- This migration creates a complete database schema for reliable booking data storage

-- Create users table with comprehensive user information
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL, -- E.164 format
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Create events table for event management
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    venue VARCHAR(255),
    max_capacity INT,
    price DECIMAL(10,2) DEFAULT 5500.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create comprehensive bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    booking_string_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    user_phone VARCHAR(20) NOT NULL, -- Keep for backward compatibility
    event_id INT REFERENCES events(id) ON DELETE CASCADE DEFAULT 1,
    
    -- Seat information
    table_number INT NOT NULL,
    seat_number INT NOT NULL,
    seat VARCHAR(50) NOT NULL, -- Format: "table-seat"
    
    -- User information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- Booking status workflow
    booking_status VARCHAR(20) DEFAULT 'selected', -- selected, awaiting_confirmation, booked_paid, cancelled
    status VARCHAR(20) DEFAULT 'pending', -- Legacy field for backward compatibility
    
    -- Payment information
    price DECIMAL(10,2) DEFAULT 5500.00,
    paid_by_client BOOLEAN DEFAULT FALSE,
    payment_confirmed_by_admin BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50), -- 'cash', 'card', 'online', etc.
    payment_reference VARCHAR(255), -- Transaction ID or reference
    
    -- Admin actions
    admin_confirmed_by VARCHAR(100),
    admin_notes TEXT,
    confirmed_at TIMESTAMPTZ,
    
    -- WhatsApp integration
    whatsapp_optin BOOLEAN DEFAULT FALSE,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    whatsapp_message_id VARCHAR(255),
    confirmation_code VARCHAR(10),
    
    -- Ticket information
    ticket_generated BOOLEAN DEFAULT FALSE,
    ticket_sent BOOLEAN DEFAULT FALSE,
    ticket_file_path VARCHAR(500),
    ticket_id VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    booked_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Additional metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    source VARCHAR(50) DEFAULT 'web', -- 'web', 'admin', 'api'
    
    -- Constraints
    CONSTRAINT valid_booking_status CHECK (booking_status IN ('selected', 'awaiting_confirmation', 'booked_paid', 'cancelled')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'confirmed', 'cancelled', 'prebooked')),
    CONSTRAINT valid_payment_method CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'online', 'bank_transfer', 'other'))
);

-- Create payments table for detailed payment tracking
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(128) UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KGS',
    status VARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    payment_method VARCHAR(50) NOT NULL,
    provider VARCHAR(50), -- 'stripe', 'paypal', 'bank', 'cash', etc.
    provider_transaction_id VARCHAR(255),
    raw_payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Create tickets table for ticket management
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    ticket_id VARCHAR(100) UNIQUE NOT NULL,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size INT,
    mime_type VARCHAR(100),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    download_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create WhatsApp opt-ins table (already exists, but ensure it's comprehensive)
CREATE TABLE IF NOT EXISTS whatsapp_opt_ins (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL, -- E.164 format
    phone_normalized VARCHAR(20),
    name VARCHAR(255),
    confirmed BOOLEAN DEFAULT false,
    confirmation_code VARCHAR(10),
    confirmed_at TIMESTAMPTZ,
    optin_source VARCHAR(100), -- 'booking_form', 'admin', 'api', etc.
    ip_address VARCHAR(45),
    user_agent TEXT,
    unsubscribed BOOLEAN DEFAULT false,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_sent_at TIMESTAMPTZ,
    consent_text TEXT,
    booking_id INT REFERENCES bookings(id) ON DELETE SET NULL
);

-- Create messages_log table for WhatsApp message tracking
CREATE TABLE IF NOT EXISTS messages_log (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100), -- Provider message ID (Twilio SID, etc.)
    phone VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'outbound' or 'inbound'
    body TEXT,
    status VARCHAR(20), -- 'sent', 'delivered', 'failed', 'received'
    error_code VARCHAR(50),
    provider VARCHAR(20), -- 'twilio', 'green_api'
    booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin_actions table for audit trail
CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    admin_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    admin_phone VARCHAR(20),
    action_type VARCHAR(50) NOT NULL, -- 'booking_created', 'payment_confirmed', 'ticket_sent', etc.
    target_booking_id INT REFERENCES bookings(id) ON DELETE CASCADE,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_logs table for application logging
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- 'error', 'warn', 'info', 'debug'
    message TEXT NOT NULL,
    context JSONB,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    booking_id INT REFERENCES bookings(id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_phone ON bookings(user_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_status ON bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_table_seat ON bookings(table_number, seat_number);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_string_id ON bookings(booking_string_id);
CREATE INDEX IF NOT EXISTS idx_bookings_whatsapp_optin ON bookings(whatsapp_optin);
CREATE INDEX IF NOT EXISTS idx_bookings_ticket_generated ON bookings(ticket_generated);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_generated_at ON tickets(generated_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_phone ON whatsapp_opt_ins(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_user_id ON whatsapp_opt_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_confirmed ON whatsapp_opt_ins(confirmed);
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_created_at ON whatsapp_opt_ins(created_at);

CREATE INDEX IF NOT EXISTS idx_messages_log_phone ON messages_log(phone);
CREATE INDEX IF NOT EXISTS idx_messages_log_booking_id ON messages_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_log_created_at ON messages_log(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_user_id ON admin_actions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_booking_id ON admin_actions(target_booking_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_booking_id ON system_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_opt_ins_updated_at ON whatsapp_opt_ins;
CREATE TRIGGER update_whatsapp_opt_ins_updated_at
    BEFORE UPDATE ON whatsapp_opt_ins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default event if it doesn't exist
INSERT INTO events (id, name, description, event_date, venue, max_capacity, price)
VALUES (1, 'GOLDENMIDDLE Event', 'Main event for ticket booking system', '2024-10-26 18:00:00+00', 'Asman', 1000, 5500.00)
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts and profile information';
COMMENT ON TABLE events IS 'Event information and configuration';
COMMENT ON TABLE bookings IS 'Main booking records with complete workflow tracking';
COMMENT ON TABLE payments IS 'Detailed payment transaction records';
COMMENT ON TABLE tickets IS 'Generated ticket files and metadata';
COMMENT ON TABLE whatsapp_opt_ins IS 'WhatsApp consent and opt-in tracking';
COMMENT ON TABLE messages_log IS 'All WhatsApp messages sent and received';
COMMENT ON TABLE admin_actions IS 'Audit trail of admin actions';
COMMENT ON TABLE system_logs IS 'Application logs and error tracking';

-- Add column comments for key fields
COMMENT ON COLUMN bookings.booking_status IS 'Current booking status: selected, awaiting_confirmation, booked_paid, cancelled';
COMMENT ON COLUMN bookings.paid_by_client IS 'Whether client marked payment as completed';
COMMENT ON COLUMN bookings.payment_confirmed_by_admin IS 'Whether admin confirmed the payment';
COMMENT ON COLUMN bookings.whatsapp_optin IS 'Whether user opted in for WhatsApp notifications';
COMMENT ON COLUMN bookings.ticket_generated IS 'Whether ticket PDF was generated';
COMMENT ON COLUMN bookings.ticket_sent IS 'Whether ticket was sent to user';
