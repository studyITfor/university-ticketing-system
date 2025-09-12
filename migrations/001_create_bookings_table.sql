-- Migration: Create bookings table
-- Description: Creates the main bookings table with all required fields
-- Version: 1.0.0
-- Created: 2025-01-27

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_id VARCHAR(10) NOT NULL,
    user_info JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    
    -- Ensure seat_id is unique for confirmed bookings
    CONSTRAINT unique_confirmed_seat UNIQUE (seat_id) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_seat_id ON bookings(seat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_user_info ON bookings USING GIN(user_info);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON bookings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE bookings IS 'Main bookings table storing all seat reservations';
COMMENT ON COLUMN bookings.id IS 'Unique booking identifier (UUID)';
COMMENT ON COLUMN bookings.seat_id IS 'Seat identifier in format table-seat (e.g., 1-5)';
COMMENT ON COLUMN bookings.user_info IS 'User information as JSON (name, email, phone, etc.)';
COMMENT ON COLUMN bookings.status IS 'Booking status: pending, confirmed, or cancelled';
COMMENT ON COLUMN bookings.created_at IS 'When the booking was created';
COMMENT ON COLUMN bookings.updated_at IS 'When the booking was last updated';
COMMENT ON COLUMN bookings.metadata IS 'Additional booking metadata as JSON';
