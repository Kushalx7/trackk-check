function parseSessionDate(value) {
  if (!value) return new Date(NaN);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw.replace(' ', 'T') + 'Z');
  }
  return new Date(raw);
}

class TrackingSession {
  constructor(db) {
    this.db = db;
  }

  // Create a new tracking session
  async create(userId) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO tracking_sessions (userId, startTime, totalDuration, status) 
                   VALUES (?, ?, 0, 'active')`;
      
      this.db.run(sql, [userId, new Date().toISOString()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            id: this.lastID, 
            userId, 
            startTime: new Date().toISOString(),
            totalDuration: 0,
            status: 'active' 
          });
        }
      });
    });
  }

  // Get session by ID
  async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT ts.*, u.name, u.username 
                   FROM tracking_sessions ts
                   JOIN users u ON ts.userId = u.id
                   WHERE ts.id = ?`;
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get active session for a user
  async getActiveSession(userId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tracking_sessions 
                   WHERE userId = ? AND status = 'active'`;
      
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Get the latest session for a user today
  async getTodaySession(userId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tracking_sessions
                   WHERE userId = ? AND date(COALESCE(endTime, startTime)) = date('now')
                   ORDER BY id DESC LIMIT 1`;

      this.db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Resume today's paused session instead of creating a new one
  async resume(sessionId) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const sql = `UPDATE tracking_sessions
                   SET startTime = ?, endTime = NULL, status = 'active'
                   WHERE id = ?`;

      this.db.run(sql, [now, sessionId], function(err) {
        if (err) reject(err);
        else resolve({ id: sessionId, startTime: now, status: 'active' });
      });
    });
  }

  // Stop a tracking session
  async stop(sessionId) {
    return new Promise((resolve, reject) => {
      const getSql = `SELECT startTime, totalDuration, status FROM tracking_sessions WHERE id = ?`;

      this.db.get(getSql, [sessionId], (err, session) => {
        if (err) {
          reject(err);
          return;
        }

        if (!session) {
          reject(new Error('Session not found'));
          return;
        }

        const startTime = parseSessionDate(session.startTime);
        const endTime = new Date();
        const segmentDuration = session.status === 'active'
          ? Math.max(0, Math.floor((endTime - startTime) / 1000))
          : 0;
        const totalDuration = (session.totalDuration || 0) + segmentDuration;

        const sql = `UPDATE tracking_sessions
                     SET endTime = ?,
                         totalDuration = ?,
                         status = 'paused'
                     WHERE id = ?`;

        this.db.run(sql, [endTime.toISOString(), totalDuration, sessionId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              changes: this.changes,
              endTime: endTime.toISOString(),
              totalDuration
            });
          }
        });
      });
    });
  }

  // Get sessions for a user
  async getUserSessions(userId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tracking_sessions 
                   WHERE userId = ? 
                   ORDER BY startTime DESC 
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

  // Get all sessions (admin only)
  async getAll(limit = 100, offset = 0, userId = null, userName = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT ts.*, u.name, u.username, u.email 
                 FROM tracking_sessions ts
                 JOIN users u ON ts.userId = u.id`;
      const params = [];
      
      if (userId) {
        sql += ` WHERE ts.userId = ?`;
        params.push(userId);
      }
      
      sql += ` ORDER BY ts.startTime DESC LIMIT ? OFFSET ?`;
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

  // Get today's sessions for a user
  async getTodaySessions(userId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tracking_sessions 
                   WHERE userId = ? AND date(startTime) = date('now')
                   ORDER BY startTime DESC`;
      
      this.db.all(sql, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get total tracked time for a user today
  async getTodayTotalTime(userId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT COALESCE(SUM(totalDuration), 0) as totalTime 
                   FROM tracking_sessions 
                   WHERE userId = ? AND date(startTime) = date('now') AND status = 'completed'`;
      
      this.db.get(sql, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.totalTime || 0);
        }
      });
    });
  }

  // Get sessions by date range
  async getByDateRange(userId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM tracking_sessions 
                   WHERE userId = ? AND date(startTime) BETWEEN ? AND ?
                   ORDER BY startTime DESC`;
      
      this.db.all(sql, [userId, startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = TrackingSession;
