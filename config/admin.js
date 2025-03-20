import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    const serviceAccountPath = join(__dirname, '..', 'service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
    });
  } catch (error) {
    console.error('Error initializing admin SDK:', error);
  }
}

const adminDb = admin.database();

// Admin functions for station management
export const deleteStation = async (stationId) => {
  try {
    const stationRef = adminDb.ref(`stations/${stationId}`);
    await stationRef.remove();
    return true;
  } catch (error) {
    console.error('Error deleting station:', error);
    throw error;
  }
};

export const updateStation = async (stationId, stationData) => {
  try {
    const stationRef = adminDb.ref(`stations/${stationId}`);
    await stationRef.update(stationData);
    return true;
  } catch (error) {
    console.error('Error updating station:', error);
    throw error;
  }
};

export const importStations = async (stations) => {
  try {
    const stationsRef = adminDb.ref('stations');
    await stationsRef.set(stations);
    return true;
  } catch (error) {
    console.error('Error importing stations:', error);
    throw error;
  }
};

export const verifyAdminToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying admin token:', error);
    throw error;
  }
};

export { adminDb };
export default admin; 