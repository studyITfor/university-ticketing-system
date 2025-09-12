-- SQLite Migration: Create bookings table
-- Description: Creates the main bookings table for SQLite fallback
-- Version: 1.0.0
-- Created: 2025-01-27

-- Note: SQLite doesn't support UUID natively, so we use TEXT
-- Note: SQLite doesn't support CHECK constraints in older versions, so we handle validation in application

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    seat_id TEXT NOT NULL,
    user_info TEXT NOT NULL, -- JSON stored as TEXT in SQLite
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}' -- JSON stored as TEXT in SQLite
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_seat_id ON bookings(seat_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);

-- Create trigger to automatically update updated_at (SQLite 3.35+)
CREATE TRIGGER IF NOT EXISTS update_bookings_updated_at 
    AFTER UPDATE ON bookings 
    FOR EACH ROW 
    WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE bookings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Add comments for documentation (SQLite doesn't support COMMENT ON, but we document here)
-- TABLE: bookings - Main bookings table storing all seat reservations
-- COLUMN: id - Unique booking identifier (UUID-like string)
-- COLUMN: seat_id - Seat identifier in format table-seat (e.g., 1-5)
-- COLUMN: user_info - User information as JSON (name, email, phone, etc.)
-- COLUMN: status - Booking status: pending, confirmed, or cancelled
-- COLUMN: created_at - When the booking was created
-- COLUMN: updated_at - When the booking was last updated
-- COLUMN: metadata - Additional booking metadata as JSON
