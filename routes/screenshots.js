const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Screenshot = require('../models/Screenshot');
const { authenticateToken, requireAdmin, canAccessSessionData } = require('../middleware/auth');


function safePathPart(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function getTenMinuteBatch(date = new Date()) {
  const start = new Date(date);
  start.setSeconds(0, 0);
  start.setMinutes(Math.floor(start.getMinutes() / 10) * 10);
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    dateKey: start.toISOString().slice(0, 10),
    batchKey: `${pad(start.getHours())}-${pad(start.getMinutes())}-to-${pad(end.getHours())}-${pad(end.getMinutes())}`,
  };
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}.png`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload screenshot
router.post('/upload', authenticateToken, upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No screenshot file provided' });
    }

    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify user owns the session
    const TrackingSession = require('../models/TrackingSession');
    const sessionModel = new TrackingSession(req.db);
    const session = await sessionModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.userId != req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const screenshotModel = new Screenshot(req.db);
    const imagePath = req.file.filename;
    
    const newScreenshot = await screenshotModel.create(
      req.user.id, 
      sessionId, 
      imagePath
    );
    
    res.status(201).json({
      message: 'Screenshot uploaded successfully',
      screenshot: newScreenshot
    });
  } catch (error) {
    console.error('Upload screenshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Get screenshots for a session
router.get('/session/:sessionId', authenticateToken, canAccessSessionData, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const screenshotModel = new Screenshot(req.db);
    
    const screenshots = await screenshotModel.getSessionScreenshots(sessionId);
    
    res.json(screenshots);
  } catch (error) {
    console.error('Get session screenshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get screenshots for current user
router.get('/my-screenshots', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const screenshotModel = new Screenshot(req.db);
    
    const screenshots = await screenshotModel.getUserScreenshots(
      req.user.id, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json(screenshots);
  } catch (error) {
    console.error('Get user screenshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's screenshots for current user
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const screenshotModel = new Screenshot(req.db);
    const screenshots = await screenshotModel.getTodayScreenshots(req.user.id);
    
    res.json(screenshots);
  } catch (error) {
    console.error('Get today screenshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all screenshots (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId, sessionId, date, userName, batchKey } = req.query;
    const screenshotModel = new Screenshot(req.db);
    
    const screenshots = await screenshotModel.getAll(
      parseInt(limit), 
      parseInt(offset), 
      userId ? parseInt(userId) : null,
      sessionId ? parseInt(sessionId) : null,
      date,
      userName || null,
      batchKey || null
    );
    
    res.json(screenshots);
  } catch (error) {
    console.error('Get all screenshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get screenshots by date range for current user
router.get('/date-range', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const screenshotModel = new Screenshot(req.db);
    const screenshots = await screenshotModel.getByDateRange(req.user.id, startDate, endDate);
    
    res.json(screenshots);
  } catch (error) {
    console.error('Get date range screenshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get screenshots by date range for specific user (admin only)
router.get('/user/:userId/date-range', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const screenshotModel = new Screenshot(req.db);
    const screenshots = await screenshotModel.getByDateRange(userId, startDate, endDate);
    
    res.json(screenshots);
  } catch (error) {
    console.error('Get user date range screenshots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve screenshot files (protected route)
router.get('/file/*', authenticateToken, async (req, res) => {
  try {
    const filename = req.params[0];
    const screenshotModel = new Screenshot(req.db);
    
    // Find screenshot by filename to check ownership
    const db = req.db;
    const sql = `SELECT s.*, u.id as userId, u.role 
                 FROM screenshots s
                 JOIN users u ON s.userId = u.id
                 WHERE s.imagePath = ?`;
    
    db.get(sql, [filename], (err, screenshot) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!screenshot) {
        return res.status(404).json({ error: 'Screenshot not found' });
      }
      
      // Check access permissions
      if (screenshot.userId != req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const filePath = path.join(__dirname, '..', 'uploads', filename);
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('File send error:', err);
          res.status(404).json({ error: 'File not found' });
        }
      });
    });
  } catch (error) {
    console.error('Serve screenshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get screenshot statistics (admin only)
router.get('/stats/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, sessionId, date } = req.query;
    const screenshotModel = new Screenshot(req.db);
    
    const count = await screenshotModel.getCount(
      userId ? parseInt(userId) : null,
      sessionId ? parseInt(sessionId) : null,
      date,
      userName || null,
      batchKey || null
    );
    
    res.json({ count });
  } catch (error) {
    console.error('Get screenshot stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get screenshot by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const screenshotModel = new Screenshot(req.db);
    const screenshot = await screenshotModel.findById(req.params.id);
    
    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }
    
    // Check access permissions
    if (screenshot.userId != req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(screenshot);
  } catch (error) {
    console.error('Get screenshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete screenshot (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const screenshotModel = new Screenshot(req.db);
    const result = await screenshotModel.delete(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Screenshot not found' });
    }
    
    // Delete the actual file
    if (result.imagePath) {
      const fs = require('fs');
      const filePath = path.join(__dirname, '..', 'uploads', result.imagePath);
      
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error('Failed to delete screenshot file:', err);
        }
      });
    }
    
    res.json({ message: 'Screenshot deleted successfully' });
  } catch (error) {
    console.error('Delete screenshot error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
