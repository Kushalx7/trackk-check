const express = require('express');
const router = express.Router();
const TrackingSession = require('../models/TrackingSession');
const { authenticateToken, requireAdmin, canAccessSessionData } = require('../middleware/auth');

// Start or resume today's tracking session
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const sessionModel = new TrackingSession(req.db);

    const activeSession = await sessionModel.getActiveSession(req.user.id);
    if (activeSession) {
      return res.status(200).json({
        message: 'Tracking session already active',
        session: activeSession
      });
    }

    const todaySession = await sessionModel.getTodaySession(req.user.id);
    if (todaySession) {
      const resumed = await sessionModel.resume(todaySession.id);
      return res.status(200).json({
        message: 'Tracking session resumed',
        session: {
          ...todaySession,
          ...resumed,
          totalDuration: todaySession.totalDuration || 0
        }
      });
    }

    const newSession = await sessionModel.create(req.user.id);

    res.status(201).json({
      message: 'Tracking session started',
      session: newSession
    });
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Stop a tracking session
router.post('/:sessionId/stop', authenticateToken, canAccessSessionData, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionModel = new TrackingSession(req.db);
    
    const result = await sessionModel.stop(sessionId);
    
    res.json({
      message: 'Tracking session stopped',
      endTime: result.endTime,
      totalDuration: result.totalDuration
    });
  } catch (error) {
    console.error('Stop session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active session for current user
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const sessionModel = new TrackingSession(req.db);
    const activeSession = await sessionModel.getActiveSession(req.user.id);
    
    if (!activeSession) {
      return res.json({ activeSession: null });
    }
    
    res.json({ activeSession });
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Get sessions for current user
router.get('/my-sessions', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sessionModel = new TrackingSession(req.db);
    
    const sessions = await sessionModel.getUserSessions(
      req.user.id, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's sessions for current user
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const sessionModel = new TrackingSession(req.db);
    
    const [sessions, totalTime] = await Promise.all([
      sessionModel.getTodaySessions(req.user.id),
      sessionModel.getTodayTotalTime(req.user.id)
    ]);
    
    res.json({
      sessions,
      totalTime,
      totalTimeFormatted: formatDuration(totalTime)
    });
  } catch (error) {
    console.error('Get today sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all sessions (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId, userName } = req.query;
    const sessionModel = new TrackingSession(req.db);
    
    const sessions = await sessionModel.getAll(
      parseInt(limit), 
      parseInt(offset), 
      userId ? parseInt(userId) : null,
      userName || null
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sessions by date range for current user
router.get('/date-range', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const sessionModel = new TrackingSession(req.db);
    const sessions = await sessionModel.getByDateRange(req.user.id, startDate, endDate);
    
    // Calculate total duration
    const totalDuration = sessions.reduce((sum, session) => sum + (session.totalDuration || 0), 0);
    
    res.json({
      sessions,
      totalDuration,
      totalDurationFormatted: formatDuration(totalDuration)
    });
  } catch (error) {
    console.error('Get date range sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sessions by date range for specific user (admin only)
router.get('/user/:userId/date-range', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const sessionModel = new TrackingSession(req.db);
    const sessions = await sessionModel.getByDateRange(userId, startDate, endDate);
    
    // Calculate total duration
    const totalDuration = sessions.reduce((sum, session) => sum + (session.totalDuration || 0), 0);
    
    res.json({
      sessions,
      totalDuration,
      totalDurationFormatted: formatDuration(totalDuration)
    });
  } catch (error) {
    console.error('Get user date range sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to format duration in seconds to human readable format
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '0h 0m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Get session by ID
router.get('/:sessionId', authenticateToken, canAccessSessionData, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionModel = new TrackingSession(req.db);
    
    const session = await sessionModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
