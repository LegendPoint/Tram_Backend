import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import stationsData from '../Main_database.json';

const firebaseConfig = {
  // Your Firebase config here
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const importStations = async () => {
  try {
    // Convert array to object with numeric IDs
    const stationsObject = stationsData.stations.reduce((acc, station) => {
      acc[station.id] = {
        nameEn: station.nameEn,
        nameTh: station.nameTh,
        lat: station.lat,
        lng: station.lng,
        colors: station.colors
      };
      return acc;
    }, {});

    // Import to Firebase
    await set(ref(database, 'stations'), stationsObject);
    console.log('Stations imported successfully!');
  } catch (error) {
    console.error('Error importing stations:', error);
  }
};

importStations(); 