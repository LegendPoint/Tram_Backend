import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase, ref, onValue, set, off } from 'firebase/database';

// Firebase client config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase client SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const realtimeDb = getDatabase(app);

// Function to get stations data from Realtime Database
export const getStationsData = (callback) => {
  const stationsRef = ref(realtimeDb, 'stations');
  
  if (callback) {
    // Subscription mode
    const unsubscribe = onValue(stationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const stationsData = Object.entries(snapshot.val()).map(([key, data]) => ({
          id: key,
          ...data
        }));
        callback(stationsData);
      } else {
        callback([]);
      }
    }, (error) => {
      console.error('Firebase data fetch error:', error);
      callback([]);
    });

    // Return unsubscribe function
    return () => {
      off(stationsRef);
      unsubscribe();
    };
  } else {
    // Promise mode
    return new Promise((resolve, reject) => {
      onValue(stationsRef, (snapshot) => {
        if (snapshot.exists()) {
          const stationsData = Object.entries(snapshot.val()).map(([key, data]) => ({
            id: key,
            ...data
          }));
          resolve(stationsData);
        } else {
          resolve([]);
        }
      }, (error) => {
        console.error('Firebase data fetch error:', error);
        reject(error);
      }, { onlyOnce: true }); // Only get the value once for Promise mode
    });
  }
};

// Function to get a specific station by ID
export const getStationById = (stationId) => {
  return new Promise((resolve, reject) => {
    const stationRef = ref(realtimeDb, `stations/${stationId}`);
    onValue(stationRef, (snapshot) => {
      if (snapshot.exists()) {
        resolve({
          id: stationId,
          ...snapshot.val()
        });
      } else {
        resolve(null);
      }
    }, reject, { onlyOnce: true });
  });
};

// Function to update a station
export const updateStation = async (stationId, stationData) => {
  const stationRef = ref(realtimeDb, `stations/${stationId}`);
  await set(stationRef, stationData);
  return getStationById(stationId);
};

// Function to get stations by color
export const getStationsByColor = async (color) => {
  try {
    const stations = await getStationsData();
    return stations.filter(station => 
      station.colors?.includes(color)
    );
  } catch (error) {
    console.error('Error getting stations by color:', error);
    throw error;
  }
};

// Function to get all station names
export const getAllStationNames = async () => {
  try {
    const stations = await getStationsData();
    return stations.map(station => ({
      id: station.id,
      nameEn: station.nameEn,
      nameTh: station.nameTh
    }));
  } catch (error) {
    console.error('Error getting station names:', error);
    throw error;
  }
};

export { 
  app, 
  auth, 
  db, 
  realtimeDb,
  signInWithEmailAndPassword 
};

