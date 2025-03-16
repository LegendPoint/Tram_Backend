import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Firebase client config (for authentication)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || import.meta?.env?.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || import.meta?.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID || import.meta?.env?.VITE_FIREBASE_APP_ID
};

// Initialize Firebase client SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const serviceAccountPath = join(__dirname, '..', 'service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL: "https://my-tram-simulation-default-rtdb.firebaseio.com"
    });
  } catch (error) {
    console.error('Error initializing admin SDK:', error);
  }
}

export { app, auth, db, admin, signInWithEmailAndPassword };

