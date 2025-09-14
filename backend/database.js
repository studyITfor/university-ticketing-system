const { Sequelize } = require('sequelize');

// Database configuration - use SQLite for local development, PostgreSQL for production
const isProduction = process.env.NODE_ENV === 'production';
// Use DATABASE_URL for internal connections in production
const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (isProduction && databaseUrl) {
  // Production: Use PostgreSQL with improved connection handling
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,           // Reduced max connections
      min: 1,           // Keep at least 1 connection alive
      acquire: 30000,   // Reduced acquire timeout
      idle: 20000,      // Increased idle timeout
      evict: 1000,      // Connection eviction interval
      handleDisconnects: true, // Handle disconnections gracefully
      retry: {
        max: 3,         // Retry failed connections
        match: [
          /ETIMEDOUT/,
          /EHOSTUNREACH/,
          /ECONNRESET/,
          /ECONNREFUSED/,
          /ETIMEDOUT/,
          /SequelizeConnectionError/,
          /SequelizeConnectionRefusedError/,
          /SequelizeHostNotFoundError/,
          /SequelizeHostNotReachableError/,
          /SequelizeInvalidConnectionError/,
          /SequelizeConnectionTimedOutError/
        ]
      }
    },
    dialectOptions: {
      connectTimeout: 30000,    // Reduced connection timeout
      acquireTimeout: 30000,    // Reduced acquire timeout
      timeout: 30000,           // Reduced query timeout
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    retry: {
      max: 3,
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  });
} else {
  // Development: Use SQLite
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './ticketing_system.db',
    logging: false
  });
}

// Define models
const Booking = sequelize.define('Booking', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ticketId: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  studentName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  studentId: {
    type: Sequelize.STRING,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING,
    allowNull: true
  },
  phone: {
    type: Sequelize.STRING,
    allowNull: false
  },
  tableNumber: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  seatNumber: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  bookingTime: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  paymentStatus: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: 'pending'
  },
  paymentMethod: {
    type: Sequelize.STRING,
    allowNull: true
  },
  paymentReference: {
    type: Sequelize.STRING,
    allowNull: true
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'bookings',
  timestamps: true
});

const Seat = sequelize.define('Seat', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  tableNumber: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  seatNumber: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  isOccupied: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  bookingId: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: {
      model: Booking,
      key: 'id'
    }
  }
}, {
  tableName: 'seats',
  timestamps: true
});

const AdminSession = sequelize.define('AdminSession', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastActivity: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  }
}, {
  tableName: 'admin_sessions',
  timestamps: true
});

// DeletionLog model for audit trail
const DeletionLog = sequelize.define('DeletionLog', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bookingId: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  ticketId: {
    type: Sequelize.STRING,
    allowNull: false
  },
  userId: {
    type: Sequelize.STRING,
    allowNull: true
  },
  userIp: {
    type: Sequelize.STRING,
    allowNull: true
  },
  isAdmin: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  bookingData: {
    type: Sequelize.TEXT,
    allowNull: false,
    comment: 'Full booking data before deletion (JSON)'
  },
  reason: {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: 'User deletion'
  },
  deletedAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  tableName: 'deletion_logs',
  timestamps: true
});

// Define associations
Booking.hasMany(Seat, { foreignKey: 'bookingId' });
Seat.belongsTo(Booking, { foreignKey: 'bookingId' });

// Initialize database
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync models with database
    await sequelize.sync({ force: false }); // Set to true to recreate tables
    console.log('Database models synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
}

// Close database connection
async function closeDatabase() {
  try {
    await sequelize.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

module.exports = {
  sequelize,
  Booking,
  Seat,
  AdminSession,
  DeletionLog,
  initializeDatabase,
  closeDatabase
};
