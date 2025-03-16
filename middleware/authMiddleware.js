import { admin } from '../config/firebase.js';

export const protect = async (req, res, next) => {
  try {
    // Get token from Authorization header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }
    
    // Verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Not authorized, token failed',
      error: error.message
    });
  }
};