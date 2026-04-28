const path = require('path');

class Screenshot {
  constructor(db) {
    this.db = db;
  }

  // Create a new screenshot record
  async create(userId, sessionId, imagePath, batchKey = null, folderPath = null) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO screenshots (userId, sessionId, imagePath, capturedAt) 
                   VALUES (?, ?, ?, datetime('now'))`;
      
      this.db.run(sql, [userId, sessionId, imagePath], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            id: this.lastID, 
            userId, 
            sessionId, 
            imagePath,
            batchKey,
            folderPath,
            capturedAt: new Date().toISOString()
          });
        }
      });
    });
  }

  // Get screenshot by ID
  async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT s.*, ts.startTime, u.name, u.username 
                   FROM screenshots s
                   JOIN tracking_sessions ts ON s.sessionId = ts.id
                   JOIN users u ON s.userId = u.id
                   WHERE s.id = ?`;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get screenshots for a session
  async getSessionScreenshots(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM screenshots 
                   WHERE sessionId = ? 
                   ORDER BY capturedAt ASC`;
      
      this.db.all(sql, [sessionId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get screenshots for a user
  async getUserScreenshots(userId, limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT s.*, ts.startTime 
                   FROM screenshots s
                   JOIN tracking_sessions ts ON s.sessionId = ts.id
                   WHERE s.userId = ? 
                   ORDER BY s.capturedAt DESC 
                   LIMIT ? OFFSET ?`;
      
      this.db.all(sql, [userId, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get all screenshots (admin only)
  async getAll(limit = 100, offset = 0, userId = null, sessionId = null, date = null, userName = null, batchKey = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT s.*, ts.startTime, u.name, u.username, u.email 
                 FROM screenshots s
                 JOIN tracking_sessions ts ON s.sessionId = ts.id
                 JOIN users u ON s.userId = u.id`;
      const params = [];
      const conditions = [];
      
      if (userId) {
        conditions.push('s.userId = ?');
        params.push(userId);
      }
      
      if (sessionId) {
        conditions.push('s.sessionId = ?');
        params.push(sessionId);
      }
      
      if (date) {
        conditions.push('date(s.capturedAt) = ?');
        params.push(date);
      }

      if (userName) {
        conditions.push('(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
        const term = `%${userName}%`;
        params.push(term, term, term);
      }

      if (batchKey) {
        conditions.push('s.batchKey = ?');
        params.push(batchKey);
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      sql += ` ORDER BY s.capturedAt DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get screenshots by date range
  async getByDateRange(userId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT s.*, ts.startTime 
                   FROM screenshots s
                   JOIN tracking_sessions ts ON s.sessionId = ts.id
                   WHERE s.userId = ? AND date(s.capturedAt) BETWEEN ? AND ?
                   ORDER BY s.capturedAt DESC`;
      
      this.db.all(sql, [userId, startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get screenshots for today
  async getTodayScreenshots(userId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT s.*, ts.startTime 
                   FROM screenshots s
                   JOIN tracking_sessions ts ON s.sessionId = ts.id
                   WHERE s.userId = ? AND date(s.capturedAt) = date('now')
                   ORDER BY s.capturedAt DESC`;
      
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Delete screenshot (admin only)
  async delete(id) {
    return new Promise((resolve, reject) => {
      // First get the screenshot to delete the file
      const getSql = `SELECT imagePath FROM screenshots WHERE id = ?`;
      
      this.db.get(getSql, [id], (err, screenshot) => {
        if (err) {
          reject(err);
          return;
        }
        
        const sql = `DELETE FROM screenshots WHERE id = ?`;
        
        this.db.run(sql, [id], function(err) {
          if (err) {
            reject(err);
          } else {
            // Return the result with file path for cleanup
            resolve({ 
              changes: this.changes,
              imagePath: screenshot ? screenshot.imagePath : null
            });
          }
        });
      });
    });
  }

  // Delete screenshots by session (when session is deleted)
  async deleteBySession(sessionId) {
    return new Promise((resolve, reject) => {
      const sql = `DELETE FROM screenshots WHERE sessionId = ?`;
      
      this.db.run(sql, [sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Get screenshot count for statistics
  async getCount(userId = null, sessionId = null, date = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT COUNT(*) as count FROM screenshots`;
      const params = [];
      const conditions = [];
      
      if (userId) {
        conditions.push('userId = ?');
        params.push(userId);
      }
      
      if (sessionId) {
        conditions.push('sessionId = ?');
        params.push(sessionId);
      }
      
      if (date) {
        conditions.push('date(capturedAt) = ?');
        params.push(date);
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }
}

module.exports = Screenshot;
