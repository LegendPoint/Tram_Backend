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

// Function to get stations by route
export const getStationsByRoute = async (routeName) => {
  try {
    // First get the route data
    const routesRef = ref(realtimeDb, 'Routes');
    const routesSnapshot = await new Promise((resolve, reject) => {
      onValue(routesRef, (snapshot) => {
        if (snapshot.exists()) {
          const routes = snapshot.val();
          const stationIds = routes[routeName] || [];
          resolve(stationIds);
        } else {
          resolve([]);
        }
      }, reject, { onlyOnce: true });
    });

    // Get all stations first
    const allStationsRef = ref(realtimeDb, 'stations');
    const allStationsSnapshot = await new Promise((resolve, reject) => {
      onValue(allStationsRef, (snapshot) => {
        if (snapshot.exists()) {
          const stations = Object.entries(snapshot.val()).map(([id, data]) => ({
            id: id,
            ...data
          }));
          resolve(stations);
        } else {
          resolve([]);
        }
      }, reject, { onlyOnce: true });
    });

    // Map route station IDs to their corresponding station data
    const stations = routesSnapshot.map(stationId => {
      const station = allStationsSnapshot.find(s => s.id === stationId.toString());
      return station ? {
        id: station.id,
        ...station
      } : null;
    });

    // Filter out any null stations and return the array
    return stations.filter(station => station !== null);
  } catch (error) {
    console.error('Error getting stations by route:', error);
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

