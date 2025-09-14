// backend/add_whatsapp_columns.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFFnDcJ@switchback.proxy.rlwy.net:23858/railway'
});

const db = {
  query: (text, params) => pool.query(text, params)
};

(async () => {
  try {
    console.log('🔧 Adding missing WhatsApp columns to bookings table...');

    // Add whatsapp_sent column
    try {
      await db.query('ALTER TABLE bookings ADD COLUMN whatsapp_sent BOOLEAN DEFAULT FALSE');
      console.log('✅ Added whatsapp_sent column');
    } catch (e) {
      if (e.code === '42701') {
        console.log('ℹ️ whatsapp_sent column already exists');
      } else {
        throw e;
      }
    }

    // Add whatsapp_message_id column
    try {
      await db.query('ALTER TABLE bookings ADD COLUMN whatsapp_message_id VARCHAR(255)');
      console.log('✅ Added whatsapp_message_id column');
    } catch (e) {
      if (e.code === '42701') {
        console.log('ℹ️ whatsapp_message_id column already exists');
      } else {
        throw e;
      }
    }

    // Verify columns were added
    const schemaSql = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      ORDER BY ordinal_position
    `;
    const schemaRes = await db.query(schemaSql);
    console.log('🗃️ Updated bookings table schema:', schemaRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));

    await pool.end();
    console.log('✅ Database schema updated successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR adding WhatsApp columns:', err);
    await pool.end();
    process.exit(1);
  }
})();
