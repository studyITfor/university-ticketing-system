-- Migration: Add booking status workflow fields
-- This migration adds fields to support the admin confirmation workflow

-- Add new columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booking_status VARCHAR(20) DEFAULT 'selected',
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 5500.00,
ADD COLUMN IF NOT EXISTS paid_by_client BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_confirmed_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_confirmed_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index on booking_status for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_table_seat ON bookings (table_number, seat_number);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at);

-- Update existing bookings to have proper status
UPDATE bookings 
SET booking_status = CASE 
    WHEN status = 'paid' OR status = 'confirmed' THEN 'booked_paid'
    WHEN status = 'pending' THEN 'awaiting_confirmation'
    WHEN status = 'prebooked' THEN 'booked_paid'
    ELSE 'selected'
END,
price = 5500.00,
updated_at = NOW()
WHERE booking_status IS NULL;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON COLUMN bookings.booking_status IS 'Booking status: selected, awaiting_confirmation, booked_paid, cancelled';
COMMENT ON COLUMN bookings.price IS 'Price of the booking in Som';
COMMENT ON COLUMN bookings.paid_by_client IS 'Whether client marked payment as done';
COMMENT ON COLUMN bookings.payment_confirmed_by_admin IS 'Whether admin confirmed the payment';
COMMENT ON COLUMN bookings.confirmed_at IS 'When admin confirmed the payment';
COMMENT ON COLUMN bookings.admin_confirmed_by IS 'Admin user who confirmed the payment';
COMMENT ON COLUMN bookings.admin_notes IS 'Admin notes about the booking';
