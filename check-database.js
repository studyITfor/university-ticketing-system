const { Client } = require('pg');

async function checkDatabase() {
    // Use public DATABASE_PUBLIC_URL for external access
    const connectionString = process.env.DATABASE_PUBLIC_URL || 
        'postgresql://postgres:BdTOpsbuzuHpMrSKSpNiyNzgezWWVFEx@nozomi.proxy.rlwy.net:18565/railway';
    
    console.log('🔗 Using connection string:', connectionString.replace(/:[^:@]+@/, ':***@'));
    
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
    });

    try {
        console.log('🔌 Connecting to PostgreSQL database...');
        await client.connect();
        console.log('✅ Connected to database successfully');

        // Check if bookings table exists
        console.log('\n📋 Checking database tables...');
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        
        console.log('📊 Available tables:');
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // Check bookings table structure
        console.log('\n🔍 Checking bookings table structure...');
        const structureResult = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'bookings' 
            ORDER BY ordinal_position;
        `);
        
        if (structureResult.rows.length > 0) {
            console.log('📊 Bookings table structure:');
            structureResult.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
            });
        } else {
            console.log('❌ Bookings table not found!');
        }

        // Query recent bookings
        console.log('\n📊 Querying recent bookings...');
        const bookingsResult = await client.query(`
            SELECT * FROM bookings 
            ORDER BY "createdAt" DESC 
            LIMIT 10;
        `);
        
        console.log(`📈 Found ${bookingsResult.rows.length} recent bookings:`);
        bookingsResult.rows.forEach((booking, index) => {
            console.log(`  ${index + 1}. ID: ${booking.id}, TicketID: ${booking.ticketId}, Name: ${booking.studentName}, Table: ${booking.tableNumber}, Seat: ${booking.seatNumber}, Status: ${booking.paymentStatus}, Created: ${booking.createdAt}`);
        });

        // Check total count
        const countResult = await client.query('SELECT COUNT(*) as total FROM bookings;');
        console.log(`\n📊 Total bookings in database: ${countResult.rows[0].total}`);

    } catch (error) {
        console.error('❌ Database error:', error.message);
        console.error('🔍 Full error:', error);
    } finally {
        await client.end();
        console.log('\n🔌 Database connection closed');
    }
}

checkDatabase();
