import express from 'express';
import { getAuth } from 'firebase-admin/auth';

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { idToken } = req.body;
    const decodedToken = await getAuth().verifyIdToken(idToken);
    res.json({ uid: decodedToken.uid });
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Verify token route
router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    const decodedToken = await getAuth().verifyIdToken(idToken);
    res.json({ uid: decodedToken.uid });
  } catch (error) {
    res.status(401).json({ error: 'Token verification failed' });
  }
});

export default router; 