const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = new User(req.db);
    const userData = await user.findByUsernameOrEmail(username);

    if (!userData) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = user.verifyPassword(password, userData.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: userData.id, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password hash from response
    const { passwordHash, ...userResponse } = userData;

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }

      const user = new User(req.db);
      const userData = await user.findById(decoded.userId);

      if (!userData) {
        return res.status(403).json({ error: 'User not found' });
      }

      res.json({
        valid: true,
        user: userData
      });
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }

      const user = new User(req.db);
      const userData = await user.findById(decoded.userId);

      if (!userData) {
        return res.status(403).json({ error: 'User not found' });
      }

      // Create new token
      const newToken = jwt.sign(
        { userId: userData.id, role: userData.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Token refreshed successfully',
        token: newToken,
        user: userData
      });
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
