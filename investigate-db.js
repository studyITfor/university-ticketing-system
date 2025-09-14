const { Pool } = require('pg');

async function investigateDatabase() {
    // Use production database URL from Railway
    const pool = new Pool({
        connectionString: 'postgresql://postgres:RtDFIatLjVcOQutcUWjWaEunUGFnDcJ@postgres.railway.internal:5432/railway'
    });

    try {
        console.log('🔍 Investigating Production Database...\n');

        // 1. Check table structure
        console.log('1️⃣ Bookings table columns:');
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' 
            ORDER BY ordinal_position
        `);
        
        columnsResult.rows.forEach(row => {
            console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });

        // 2. Check recent bookings
        console.log('\n2️⃣ Recent bookings (last 5):');
        const recentBookings = await pool.query(`
            SELECT id, booking_string_id, first_name, last_name, status, created_at
            FROM bookings 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        recentBookings.rows.forEach(booking => {
            console.log(`   ID: ${booking.id}, String ID: ${booking.booking_string_id}, Name: ${booking.first_name} ${booking.last_name}, Status: ${booking.status}`);
        });

        // 3. Check for specific booking ID that failed
        console.log('\n3️⃣ Testing specific booking ID lookup:');
        const testBookingId = 'BKMFJU7O2P'; // From our previous test
        
        // Try lookup by booking_string_id
        const byStringId = await pool.query(
            'SELECT * FROM bookings WHERE booking_string_id = $1',
            [testBookingId]
        );
        console.log(`   By booking_string_id '${testBookingId}': ${byStringId.rows.length} results`);
        
        // Try lookup by numeric id
        const byNumericId = await pool.query(
            'SELECT * FROM bookings WHERE id::text = $1',
            [testBookingId]
        );
        console.log(`   By id::text '${testBookingId}': ${byNumericId.rows.length} results`);

        // 4. Check if there are any bookings without booking_string_id
        console.log('\n4️⃣ Bookings without booking_string_id:');
        const missingStringId = await pool.query(`
            SELECT id, first_name, last_name, created_at 
            FROM bookings 
            WHERE booking_string_id IS NULL OR booking_string_id = ''
        `);
        console.log(`   Found ${missingStringId.rows.length} bookings without booking_string_id`);
        missingStringId.rows.forEach(booking => {
            console.log(`     ID: ${booking.id}, Name: ${booking.first_name} ${booking.last_name}`);
        });

        // 5. Check payments table
        console.log('\n5️⃣ Payments table structure:');
        const paymentsColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'payments' 
            ORDER BY ordinal_position
        `);
        
        if (paymentsColumns.rows.length > 0) {
            paymentsColumns.rows.forEach(row => {
                console.log(`   ${row.column_name}: ${row.data_type}`);
            });
        } else {
            console.log('   Payments table does not exist');
        }

    } catch (error) {
        console.error('❌ Database investigation error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await pool.end();
    }
}

investigateDatabase();
