import { auth, signInWithEmailAndPassword } from '../config/firebase.js';

export const login = async (req, res) => {
  const { email, password } = req.body; // Get email & password from frontend request

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const logout = (req, res) => {
  res.status(200).json({ message: 'User logged out' });
};
