import tramService from '../services/tramService';
import Tram from '../models/tramModel';

class TramController {
  constructor() {
    this.initializeTramTracking();
  }

  initializeTramTracking() {
    tramService.initializeTramTracking((tramPositions) => {
      console.log('Tram positions updated:', tramPositions);
    });
  }

  // Update tram position
  async updateTramPosition(tramId, positionData) {
    try {
      // Validate tram data
      Tram.validate(positionData);

      // Update tram position in database
      const tramRef = ref(getDatabase(), `tramPositions/${tramId}`);
      await set(tramRef, {
        ...positionData,
        lastUpdated: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating tram position:', error);
      throw error;
    }
  }

  // Get optimal route between stations
  async getRoute(originId, destinationId) {
    try {
      const route = await tramService.getOptimalRoute(originId, destinationId);
      
      if (!route) {
        throw new Error('No valid route found between the selected stations');
      }

      return {
        success: true,
        data: route
      };
    } catch (error) {
      console.error('Error getting route:', error);
      throw error;
    }
  }

  // Get all active trams
  async getActiveTrams() {
    try {
      const trams = Array.from(tramService.tramPositions.values())
        .filter(tram => tram.status === 'active')
        .map(tram => new Tram(tram).toJSON());

      return {
        success: true,
        data: trams
      };
    } catch (error) {
      console.error('Error getting active trams:', error);
      throw error;
    }
  }

  // Get tram positions near a station
  async getTramsNearStation(stationId, rangeKm = 0.5) {
    try {
      const station = tramService.stationData[stationId];
      if (!station) {
        throw new Error('Station not found');
      }

      const nearbyTrams = Array.from(tramService.tramPositions.values())
        .filter(tram => {
          const tramInstance = new Tram(tram);
          return tramInstance.isWithinRange(station.lat, station.lng, rangeKm);
        })
        .map(tram => new Tram(tram).toJSON());

      return {
        success: true,
        data: nearbyTrams
      };
    } catch (error) {
      console.error('Error getting trams near station:', error);
      throw error;
    }
  }
}

export default new TramController(); 