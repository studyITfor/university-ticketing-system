// backend/database.js
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set - using mock database for local testing');
  // Return mock functions for local testing
  module.exports = { 
    pool: null, 
    query: async () => ({ rows: [] }), 
    getSeatStatuses: async () => [], 
    checkDatabaseHealth: async () => false 
  };
  return;
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function getSeatStatuses() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        user_phone,
        seat,
        status,
        created_at,
        updated_at
      FROM bookings 
      ORDER BY created_at DESC
    `);
    
    // Transform the data to match the expected format
    return result.rows.map(booking => {
      // Parse seat format like "3-5" to get table_number and seat_number
      const [table_number, seat_number] = booking.seat.split('-').map(Number);
      
      return {
        id: booking.id,
        user_phone: booking.user_phone,
        table_number: table_number,
        seat_number: seat_number,
        status: booking.status,
        created_at: booking.created_at,
        updated_at: booking.updated_at
      };
    });
  } catch (error) {
    console.error('Error fetching seat statuses:', error);
    return [];
  }
}

async function checkDatabaseHealth() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

module.exports = { pool, query, getSeatStatuses, checkDatabaseHealth };