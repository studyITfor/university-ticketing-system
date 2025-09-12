#!/usr/bin/env node

/**
 * Backup utility for the ticketing system
 * Creates backups of all important data before making changes
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DataBackup {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'data', 'backups');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    }

    async createBackup() {
        console.log('📦 Creating comprehensive data backup...');
        
        try {
            // Create backup directory
            await fs.ensureDir(this.backupDir);
            
            const backupName = `backup-${this.timestamp}`;
            const backupPath = path.join(this.backupDir, backupName);
            await fs.ensureDir(backupPath);
            
            // Backup files
            await this.backupFiles(backupPath);
            
            // Create database dump if PostgreSQL is available
            await this.backupDatabase(backupPath);
            
            // Create backup manifest
            await this.createManifest(backupPath);
            
            console.log(`✅ Backup created successfully: ${backupPath}`);
            console.log('📋 Backup contents:');
            const contents = await fs.readdir(backupPath);
            contents.forEach(file => console.log(`  - ${file}`));
            
        } catch (error) {
            console.error('❌ Backup failed:', error);
            throw error;
        }
    }

    async backupFiles(backupPath) {
        console.log('📄 Backing up files...');
        
        const filesToBackup = [
            'bookings.json',
            'secure-tickets-database.json',
            'tickets-database.json',
            'config.js',
            'package.json',
            'package-lock.json'
        ];
        
        for (const file of filesToBackup) {
            const sourcePath = path.join(__dirname, '..', file);
            if (await fs.pathExists(sourcePath)) {
                const destPath = path.join(backupPath, file);
                await fs.copy(sourcePath, destPath);
                console.log(`  ✅ Backed up: ${file}`);
            } else {
                console.log(`  ℹ️ File not found: ${file}`);
            }
        }
        
        // Backup tickets directory
        const ticketsDir = path.join(__dirname, '..', 'tickets');
        if (await fs.pathExists(ticketsDir)) {
            const destTicketsDir = path.join(backupPath, 'tickets');
            await fs.copy(ticketsDir, destTicketsDir);
            console.log('  ✅ Backed up: tickets/ directory');
        }
        
        // Backup data directory
        const dataDir = path.join(__dirname, '..', 'data');
        if (await fs.pathExists(dataDir)) {
            const destDataDir = path.join(backupPath, 'data');
            await fs.copy(dataDir, destDataDir);
            console.log('  ✅ Backed up: data/ directory');
        }
    }

    async backupDatabase(backupPath) {
        console.log('🗄️ Backing up database...');
        
        const databaseUrl = process.env.DATABASE_URL;
        
        if (databaseUrl && databaseUrl.startsWith('postgres://')) {
            try {
                console.log('  🐘 Creating PostgreSQL dump...');
                const dumpFile = path.join(backupPath, 'database.sql');
                
                // Extract connection details from DATABASE_URL
                const url = new URL(databaseUrl);
                const host = url.hostname;
                const port = url.port || 5432;
                const database = url.pathname.slice(1);
                const username = url.username;
                const password = url.password;
                
                // Set PGPASSWORD environment variable
                process.env.PGPASSWORD = password;
                
                const pgDumpCommand = `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --no-password --clean --if-exists --create > "${dumpFile}"`;
                
                await execAsync(pgDumpCommand);
                console.log('  ✅ PostgreSQL dump created');
                
            } catch (error) {
                console.log('  ⚠️ PostgreSQL dump failed (this is okay if pg_dump is not installed):', error.message);
            }
        } else {
            console.log('  ℹ️ No PostgreSQL database URL found, skipping database backup');
        }
        
        // Backup SQLite database if it exists
        const sqliteDbPath = path.join(__dirname, '..', 'data', 'bookings.db');
        if (await fs.pathExists(sqliteDbPath)) {
            const destSqlitePath = path.join(backupPath, 'bookings.db');
            await fs.copy(sqliteDbPath, destSqlitePath);
            console.log('  ✅ SQLite database backed up');
        }
    }

    async createManifest(backupPath) {
        console.log('📋 Creating backup manifest...');
        
        const manifest = {
            timestamp: this.timestamp,
            backupDate: new Date().toISOString(),
            version: '1.0.0',
            description: 'Ticketing system data backup',
            files: [],
            database: {
                type: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
                url: process.env.DATABASE_URL ? '***hidden***' : 'local'
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        
        // List all files in backup
        const files = await this.getAllFiles(backupPath);
        manifest.files = files.map(file => ({
            path: path.relative(backupPath, file),
            size: fs.statSync(file).size,
            modified: fs.statSync(file).mtime.toISOString()
        }));
        
        const manifestPath = path.join(backupPath, 'backup-manifest.json');
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        
        console.log('  ✅ Backup manifest created');
    }

    async getAllFiles(dir) {
        const files = [];
        const items = await fs.readdir(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
                const subFiles = await this.getAllFiles(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    async listBackups() {
        console.log('📋 Available backups:');
        
        if (!await fs.pathExists(this.backupDir)) {
            console.log('  No backups found');
            return;
        }
        
        const backups = await fs.readdir(this.backupDir);
        const backupDirs = backups.filter(item => {
            const fullPath = path.join(this.backupDir, item);
            return fs.statSync(fullPath).isDirectory();
        });
        
        if (backupDirs.length === 0) {
            console.log('  No backup directories found');
            return;
        }
        
        for (const backup of backupDirs.sort().reverse()) {
            const backupPath = path.join(this.backupDir, backup);
            const manifestPath = path.join(backupPath, 'backup-manifest.json');
            
            if (await fs.pathExists(manifestPath)) {
                const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
                console.log(`  📦 ${backup}`);
                console.log(`     Date: ${manifest.backupDate}`);
                console.log(`     Files: ${manifest.files.length}`);
                console.log(`     Database: ${manifest.database.type}`);
            } else {
                console.log(`  📦 ${backup} (no manifest)`);
            }
        }
    }

    async restoreBackup(backupName) {
        console.log(`🔄 Restoring backup: ${backupName}...`);
        
        const backupPath = path.join(this.backupDir, backupName);
        
        if (!await fs.pathExists(backupPath)) {
            throw new Error(`Backup not found: ${backupName}`);
        }
        
        // Restore files
        const filesToRestore = [
            'bookings.json',
            'secure-tickets-database.json',
            'tickets-database.json',
            'config.js'
        ];
        
        for (const file of filesToRestore) {
            const sourcePath = path.join(backupPath, file);
            if (await fs.pathExists(sourcePath)) {
                const destPath = path.join(__dirname, '..', file);
                await fs.copy(sourcePath, destPath);
                console.log(`  ✅ Restored: ${file}`);
            }
        }
        
        // Restore tickets directory
        const sourceTicketsDir = path.join(backupPath, 'tickets');
        if (await fs.pathExists(sourceTicketsDir)) {
            const destTicketsDir = path.join(__dirname, '..', 'tickets');
            await fs.copy(sourceTicketsDir, destTicketsDir);
            console.log('  ✅ Restored: tickets/ directory');
        }
        
        // Restore SQLite database
        const sourceDbPath = path.join(backupPath, 'bookings.db');
        if (await fs.pathExists(sourceDbPath)) {
            const destDbPath = path.join(__dirname, '..', 'data', 'bookings.db');
            await fs.ensureDir(path.dirname(destDbPath));
            await fs.copy(sourceDbPath, destDbPath);
            console.log('  ✅ Restored: SQLite database');
        }
        
        console.log('✅ Backup restored successfully');
    }
}

// Command line interface
async function main() {
    const command = process.argv[2];
    const backup = new DataBackup();
    
    switch (command) {
        case 'create':
            await backup.createBackup();
            break;
        case 'list':
            await backup.listBackups();
            break;
        case 'restore':
            const backupName = process.argv[3];
            if (!backupName) {
                console.log('Usage: node backup-data.js restore <backup-name>');
                process.exit(1);
            }
            await backup.restoreBackup(backupName);
            break;
        default:
            console.log('Usage: node backup-data.js [create|list|restore]');
            console.log('  create   - Create a new backup');
            console.log('  list     - List available backups');
            console.log('  restore  - Restore a specific backup');
            process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = DataBackup;
