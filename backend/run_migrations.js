// backend/run_migrations.js
const fs = require('fs');
const path = require('path');
const { pool } = require('./database');

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');
    
    // Check if we have a real database connection
    if (!pool) {
      console.log('⚠️  No database connection available - migrations skipped');
      console.log('   Set DATABASE_URL environment variable to run migrations');
      return;
    }
    
    // Check if migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    // Get list of migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`📁 Found ${migrationFiles.length} migration files`);
    
    for (const filename of migrationFiles) {
      // Check if migration already executed
      const result = await pool.query(
        'SELECT id FROM migrations WHERE filename = $1',
        [filename]
      );
      
      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${filename} (already executed)`);
        continue;
      }
      
      console.log(`🔄 Executing ${filename}...`);
      
      // Read and execute migration
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migrationSQL);
      
      // Record migration as executed
      await pool.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      console.log(`✅ ${filename} executed successfully`);
    }
    
    console.log('🎉 All migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };
