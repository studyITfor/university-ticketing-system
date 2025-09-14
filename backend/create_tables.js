// backend/create_tables.js
const { pool } = require('./database');

async function create() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(20) UNIQUE NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_phone VARCHAR(20) NOT NULL,
      event_id INT NOT NULL,
      seat VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'reserved',
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(128) UNIQUE,
      user_phone VARCHAR(20),
      amount INT,
      status VARCHAR(20),
      provider VARCHAR(50),
      raw_payload JSONB,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_actions (
      id SERIAL PRIMARY KEY,
      admin_phone VARCHAR(20),
      action_type VARCHAR(50),
      details JSONB,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  console.log('Tables created');
  await pool.end();
}

create().catch(err => {
  console.error(err);
  process.exit(1);
});
