import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv'

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to your service account key file
const serviceAccountPath = join(__dirname, '../service-account.json');

// Initialize the app with a service account, granting admin privileges
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL // Replace with your actual Firebase DB URL
    });
  } catch (error) {
    console.error('Error initializing admin app:', error);
  }
}

// Export the admin database reference
export const adminDb = admin.database();