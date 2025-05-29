import express from 'express';
import { verifyToken } from '../middleware/firebaseAuth.js';

const router = express.Router();

// Get user profile - protected route
router.get('/profile', verifyToken, (req, res) => {
  res.json({
    message: 'Protected route accessed successfully',
    user: req.user
  });
});

// Example of a role-based protected route
router.get('/admin', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  res.json({ message: 'Admin route accessed successfully' });
});

export default router; 