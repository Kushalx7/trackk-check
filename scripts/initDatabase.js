const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created successfully.');
    }
  });

  // Tracking sessions table
  db.run(`CREATE TABLE IF NOT EXISTS tracking_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    startTime DATETIME NOT NULL,
    endTime DATETIME,
    totalDuration INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating tracking_sessions table:', err.message);
    } else {
      console.log('Tracking sessions table created successfully.');
    }
  });

  // Screenshots table
  db.run(`CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    sessionId INTEGER NOT NULL,
    imagePath TEXT NOT NULL,
    batchKey TEXT,
    folderPath TEXT,
    capturedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id),
    FOREIGN KEY (sessionId) REFERENCES tracking_sessions (id)
  )`, (err) => {
    if (err) {
      console.error('Error creating screenshots table:', err.message);
    } else {
      console.log('Screenshots table created successfully.');
    }
  });

  // Insert default admin user (password: admin123)
  const bcrypt = require('bcryptjs');
  const defaultAdminPassword = bcrypt.hashSync('admin123', 10);
  
  db.run(`INSERT OR IGNORE INTO users (name, username, email, passwordHash, role) 
    VALUES (?, ?, ?, ?, ?)`, 
    ['Admin User', 'admin', 'admin@company.com', defaultAdminPassword, 'admin'],
    (err) => {
      if (err) {
        console.error('Error inserting default admin:', err.message);
      } else {
        console.log('Default admin user created successfully.');
        console.log('Username: admin, Password: admin123');
      }
    }
  );
});

db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});
