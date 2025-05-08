import { getDatabase, ref, onValue, get } from 'firebase/database';

class TramService {
  constructor() {
    this.db = getDatabase();
    this.tramPositions = new Map(); // Store current tram positions
    this.stationData = null; // Store station data
    this.routesData = null; // Store route data
    this.scheduleData = null; // Store schedule data
  }

  // Initialize tram tracking
  initializeTramTracking(callback) {
    const tramRef = ref(this.db, 'tram_location');
    
    // Listen for real-time updates
    onValue(tramRef, (snapshot) => {
      if (snapshot.exists()) {
        const positions = snapshot.val();
        // Convert to Map and transform data format
        this.tramPositions = new Map(
          Object.entries(positions).map(([id, data]) => [
            id,
            {
              id,
              lat: data.latitude,
              lng: data.longitude,
              color: data.color,
              lastUpdated: new Date().toISOString(),
              status: 'active'
            }
          ])
        );
        if (callback) callback(this.tramPositions);
      }
    });

    // Load all required data
    this.loadStationData();
    this.loadRouteData();
    this.loadScheduleData();
  }

  // Get all tram positions with real-time updates
  getAllTramPositions(callback) {
    const tramRef = ref(this.db, 'tram_location');
    let lastFetchTime = 0;
    const FETCH_INTERVAL = 3000; // 3 seconds in milliseconds

    return onValue(tramRef, (snapshot) => {
      const currentTime = Date.now();
      if (currentTime - lastFetchTime < FETCH_INTERVAL) {
        return; // Skip if not enough time has passed
      }
      lastFetchTime = currentTime;

      if (snapshot.exists()) {
        const positions = snapshot.val();
        // Filter out the 'init' placeholder and convert to array
        const positionsArray = Object.entries(positions)
          .filter(([id]) => id !== 'init')
          .map(([id, data]) => ({
            id,
            lat: data.latitude,
            lng: data.longitude,
            color: data.color,
            lastUpdated: new Date().toISOString()
          }));
        callback(positionsArray);
      } else {
        callback([]);
      }
    });
  }

  // Get tram positions by color
  getTramPositionsByColor(color) {
    return Array.from(this.tramPositions.values())
      .filter(tram => tram.color.toLowerCase() === color.toLowerCase())
      .map(tram => ({
        id: tram.id,
        lat: tram.lat,
        lng: tram.lng,
        lastUpdated: tram.lastUpdated
      }));
  }

  // Load station data
  async loadStationData() {
    try {
      const stationsRef = ref(this.db, 'stations');
      const snapshot = await get(stationsRef);
      if (snapshot.exists()) {
        this.stationData = snapshot.val();
      }
    } catch (error) {
      console.error('Error loading station data:', error);
    }
  }

  // Load route data
  async loadRouteData() {
    try {
      const routesRef = ref(this.db, 'adminRoutes');
      const snapshot = await get(routesRef);
      if (snapshot.exists()) {
        this.routesData = snapshot.val();
      }
    } catch (error) {
      console.error('Error loading route data:', error);
    }
  }

  // Load schedule data
  async loadScheduleData() {
    try {
      const scheduleRef = ref(this.db, 'schedule');
      const snapshot = await get(scheduleRef);
      if (snapshot.exists()) {
        this.scheduleData = snapshot.val();
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    }
  }

  // Calculate distance between two points
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Find nearest tram to a station
  findNearestTram(stationId, stationColors) {
    if (!this.stationData || !this.tramPositions.size) return null;

    const station = this.stationData[stationId];
    if (!station) return null;

    let nearestTram = null;
    let minDistance = Infinity;

    this.tramPositions.forEach((tram, tramId) => {
      // Check if tram color matches any of the station colors
      if (stationColors.includes(tram.color)) {
        const distance = this.calculateDistance(
          station.lat,
          station.lng,
          tram.lat,
          tram.lng
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestTram = {
            ...tram,
            distance,
            tramId
          };
        }
      }
    });

    return nearestTram;
  }

  // Calculate next arrival time based on schedule
  calculateNextArrivalTime(stationId, tramColor) {
    if (!this.scheduleData || !this.stationData) return null;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes
    const dayType = now.getDay() === 0 || now.getDay() === 6 ? 'Weekend' : 'Weekday';
    
    const station = this.stationData[stationId];
    if (!station || !station.Timetable) return null;

    const schedule = station.Timetable[dayType][tramColor];
    if (!schedule || schedule[0] === 'Out of service') return null;

    // Find next arrival time
    for (const timeStr of schedule) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const timeInMinutes = hours * 60 + minutes;
      
      if (timeInMinutes > currentTime) {
        return timeInMinutes - currentTime; // Minutes until next arrival
      }
    }

    // If no future time found today, get first time tomorrow
    const firstTime = schedule[0];
    const [hours, minutes] = firstTime.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    return (24 * 60 - currentTime) + timeInMinutes; // Minutes until next arrival
  }

  // Get optimal route between stations
  async getOptimalRoute(originId, destinationId) {
    if (!this.stationData || !this.routesData) return null;

    const origin = this.stationData[originId];
    const destination = this.stationData[destinationId];

    if (!origin || !destination) return null;

    // Find common colors between stations
    const commonColors = origin.colors.filter(color => 
      destination.colors.includes(color)
    );

    if (commonColors.length === 0) return null;

    // Find nearest tram to origin for each common color
    const tramOptions = commonColors.map(color => {
      const nearestTram = this.findNearestTram(originId, [color]);
      const nextArrivalTime = this.calculateNextArrivalTime(originId, color);
      
      return {
        color,
        tram: nearestTram,
        nextArrivalTime
      };
    }).filter(option => option.tram !== null && option.nextArrivalTime !== null);

    if (tramOptions.length === 0) return null;

    // Sort by total waiting time (distance + schedule)
    tramOptions.sort((a, b) => {
      const timeA = a.nextArrivalTime;
      const timeB = b.nextArrivalTime;
      return timeA - timeB;
    });

    const bestOption = tramOptions[0];

    // Get route details
    const routeDetails = {
      color: bestOption.color,
      stations: this.routesData[bestOption.color.toLowerCase()] || []
    };

    return {
      origin,
      destination,
      nearestTram: bestOption.tram,
      waitingTime: bestOption.nextArrivalTime,
      routeTime: this.calculateRouteTime(originId, destinationId, bestOption.color),
      totalTime: bestOption.nextArrivalTime + this.calculateRouteTime(originId, destinationId, bestOption.color),
      color: bestOption.color,
      routeDetails
    };
  }

  // Calculate route time based on schedule
  calculateRouteTime(originId, destinationId, color) {
    if (!this.scheduleData || !this.stationData) return null;

    const origin = this.stationData[originId];
    const destination = this.stationData[destinationId];
    if (!origin || !destination) return null;

    // Get the route stations
    const routeStations = this.routesData[color.toLowerCase()] || [];
    const originIndex = routeStations.indexOf(originId);
    const destinationIndex = routeStations.indexOf(destinationId);

    if (originIndex === -1 || destinationIndex === -1) return null;

    // Calculate number of stations between origin and destination
    const stationCount = Math.abs(destinationIndex - originIndex);
    
    // Assuming each station takes 2 minutes to reach
    return stationCount * 2;
  }
}

export default new TramService(); 