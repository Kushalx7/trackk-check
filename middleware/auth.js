const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      // Get user from database to ensure they still exist
      const user = new User(req.db);
      const userData = await user.findById(decoded.userId);
      
      if (!userData) {
        return res.status(403).json({ error: 'User not found' });
      }

      req.user = userData;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
  });
};

// Admin role check middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// User role check middleware (can access their own data)
const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ error: 'User access required' });
  }
  next();
};

// Check if user can access specific user's data (admin or self)
const canAccessUserData = (req, res, next) => {
  const targetUserId = req.params.userId || req.params.id;
  
  // Admin can access any user's data
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Users can only access their own data
  if (req.user.id == targetUserId) {
    return next();
  }
  
  return res.status(403).json({ error: 'Access denied: Cannot access other users\' data' });
};

// Check if user can access specific session's data
const canAccessSessionData = async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId || req.params.id;
    
    // Admin can access any session
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if session belongs to the user
    const TrackingSession = require('../models/TrackingSession');
    const sessionModel = new TrackingSession(req.db);
    const session = await sessionModel.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.userId == req.user.id) {
      return next();
    }
    
    return res.status(403).json({ error: 'Access denied: Cannot access other users\' sessions' });
  } catch (error) {
    return res.status(500).json({ error: 'Error checking session access' });
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireUser,
  canAccessUserData,
  canAccessSessionData
};
