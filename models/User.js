const bcrypt = require('bcryptjs');

class User {
  constructor(db) {
    this.db = db;
  }

  // Create a new user
  async create(userData) {
    const { name, username, email, password, role = 'user' } = userData;
    const passwordHash = bcrypt.hashSync(password, 10);
    
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO users (name, username, email, passwordHash, role) 
                   VALUES (?, ?, ?, ?, ?)`;
      
      this.db.run(sql, [name, username, email, passwordHash, role], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, name, username, email, role });
        }
      });
    });
  }

  // Find user by ID
  async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT id, name, username, email, role, createdAt 
                   FROM users WHERE id = ?`;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Find user by username or email
  async findByUsernameOrEmail(identifier) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM users 
                   WHERE username = ? OR email = ?`;
      
      this.db.get(sql, [identifier, identifier], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Verify password
  verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  // Get all users (admin only)
  async getAll() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT id, name, username, email, role, createdAt 
                   FROM users ORDER BY createdAt DESC`;
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Update user profile fields only. Role changes are intentionally disabled.
  async update(id, userData) {
    const { name, username, email } = userData;
    
    return new Promise((resolve, reject) => {
      const sql = `UPDATE users 
                   SET name = ?, username = ?, email = ?
                   WHERE id = ?`;
      
      this.db.run(sql, [name, username, email, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Update password
  async updatePassword(id, newPassword) {
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    
    return new Promise((resolve, reject) => {
      const sql = `UPDATE users SET passwordHash = ? WHERE id = ?`;
      
      this.db.run(sql, [passwordHash, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Delete user
  async delete(id) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM users WHERE id = ?`;
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
}

module.exports = User;
