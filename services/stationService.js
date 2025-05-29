import { getDatabase, ref, onValue, get } from 'firebase/database';

class StationService {
  constructor() {
    this.db = getDatabase();
  }

  // Get all stations with real-time updates
  getAllStations(callback) {
    const stationsRef = ref(this.db, 'stations');
    return onValue(stationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const stationsData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data
        }));
        callback(stationsData);
      } else {
        callback([]);
      }
    });
  }

  // Get all station names
  getAllStationNames(callback) {
    const stationsRef = ref(this.db, 'stations');
    return onValue(stationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const stationsList = Object.entries(snapshot.val()).map(([key, data]) => ({
          key,
          nameEn: data.nameEn,
          nameTh: data.nameTh
        }));
        callback(stationsList);
      } else {
        callback([]);
      }
    });
  }

  // Get stations by route
  async getStationsByRoute(routeName) {
    const stationsRef = ref(this.db, 'stations');
    const snapshot = await get(stationsRef);
    
    if (snapshot.exists()) {
      return Object.entries(snapshot.val())
        .map(([id, data]) => ({
          id,
          ...data
        }))
        .filter(station => station.colors && station.colors.includes(routeName));
    }
    return [];
  }
}

export default new StationService(); 