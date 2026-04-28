const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, requireAdmin, canAccessUserData } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = new User(req.db);
    const users = await user.getAll();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID (admin or self)
router.get('/:id', authenticateToken, canAccessUserData, async (req, res) => {
  try {
    const user = new User(req.db);
    const userData = await user.findById(req.params.id);
    
    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(userData);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const role = 'user';

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }


    const user = new User(req.db);
    const newUser = await user.create({ name, username, email, password, role });
    
    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      if (error.message.includes('username')) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (admin or self)
router.put('/:id', authenticateToken, canAccessUserData, async (req, res) => {
  try {
    const { name, username, email } = req.body;
    const userId = req.params.id;

    // Role changes are disabled. Keep the existing single admin account unchanged.

    if (!name || !username || !email) {
      return res.status(400).json({ error: 'Name, username, and email are required' });
    }


    const user = new User(req.db);
    const result = await user.update(userId, { name, username, email });
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      if (error.message.includes('username')) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      if (error.message.includes('email')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user password (self or admin)
router.put('/:id/password', authenticateToken, canAccessUserData, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const user = new User(req.db);
    const result = await user.updatePassword(userId, newPassword);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId == req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = new User(req.db);
    const result = await user.delete(userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
