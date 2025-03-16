import express from 'express';
import { login, logout } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', (req, res) => {
  console.log('Login route hit', req.body);
  login(req, res);
});

router.post('/logout', (req, res) => {
  logout(req, res);
});

router.get('/profile', protect, (req, res) => {
  res.status(200).json({
    message: 'Protected route accessed successfully',
    user: req.user
  });
});

export { router as default };
