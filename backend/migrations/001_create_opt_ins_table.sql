-- Migration: Create opt_ins table for WhatsApp opt-in management
-- Created: 2025-01-27
-- Description: Stores user opt-in consent, confirmation codes, and unsubscribe status

CREATE TABLE IF NOT EXISTS opt_ins (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL, -- E.164 format
    phone_normalized VARCHAR(20), -- Normalized phone number
    name VARCHAR(255),
    confirmed BOOLEAN DEFAULT false,
    confirmation_code VARCHAR(10),
    confirmed_at TIMESTAMPTZ,
    optin_source VARCHAR(100), -- 'booking_form', 'admin', etc.
    ip_address VARCHAR(45), -- IPv4/IPv6
    user_agent TEXT,
    unsubscribed BOOLEAN DEFAULT false,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_sent_at TIMESTAMPTZ,
    consent_text TEXT, -- Store the exact consent text shown to user
    booking_id INT NULL -- Reference to booking if opt-in was during booking
);

-- Create index on phone for fast lookups
CREATE INDEX IF NOT EXISTS idx_opt_ins_phone ON opt_ins(phone);

-- Create index on confirmation_code for fast confirmation lookups
CREATE INDEX IF NOT EXISTS idx_opt_ins_confirmation_code ON opt_ins(confirmation_code);

-- Create index on confirmed status for filtering
CREATE INDEX IF NOT EXISTS idx_opt_ins_confirmed ON opt_ins(confirmed);

-- Create index on unsubscribed status for filtering
CREATE INDEX IF NOT EXISTS idx_opt_ins_unsubscribed ON opt_ins(unsubscribed);

-- Create messages_log table for tracking all WhatsApp messages
CREATE TABLE IF NOT EXISTS messages_log (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100), -- Provider message ID (Twilio SID, etc.)
    phone VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'outbound' or 'inbound'
    body TEXT,
    status VARCHAR(20), -- 'sent', 'delivered', 'failed', 'received'
    error_code VARCHAR(50),
    provider VARCHAR(20), -- 'twilio', 'green_api'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on phone for message lookups
CREATE INDEX IF NOT EXISTS idx_messages_log_phone ON messages_log(phone);

-- Create index on message_id for provider lookups
CREATE INDEX IF NOT EXISTS idx_messages_log_message_id ON messages_log(message_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_messages_log_created_at ON messages_log(created_at);
