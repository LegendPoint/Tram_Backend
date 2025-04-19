import { getDatabase, ref, remove, update, set } from 'firebase/database';
import { getAuth } from 'firebase/auth';

// Get the database instance
const db = getDatabase();

// Admin functions for station management
export const deleteStation = async (stationId) => {
  try {
    const stationRef = ref(db, `stations/${stationId}`);
    await remove(stationRef);
    return true;
  } catch (error) {
    console.error('Error deleting station:', error);
    throw error;
  }
};

export const updateStation = async (stationId, stationData) => {
  try {
    const stationRef = ref(db, `stations/${stationId}`);
    await update(stationRef, stationData);
    return true;
  } catch (error) {
    console.error('Error updating station:', error);
    throw error;
  }
};

export const importStations = async (stations) => {
  try {
    const stationsRef = ref(db, 'stations');
    await set(stationsRef, stations);
    return true;
  } catch (error) {
    console.error('Error importing stations:', error);
    throw error;
  }
};

// Function to verify admin status
export const verifyAdminToken = async (idToken) => {
  try {
    const user = await getAuth().currentUser;
    if (!user) return false;
    
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.admin === true;
  } catch (error) {
    console.error('Error verifying admin token:', error);
    return false;
  }
}; 