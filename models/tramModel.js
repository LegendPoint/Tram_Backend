class Tram {
  constructor(data) {
    this.id = data.id;
    this.lat = data.lat;
    this.lng = data.lng;
    this.color = data.color; // Single color instead of array
    this.lastUpdated = data.lastUpdated || new Date().toISOString();
    this.status = data.status || 'active';
    this.currentStation = data.currentStation || null;
  }

  toJSON() {
    return {
      id: this.id,
      lat: this.lat,
      lng: this.lng,
      color: this.color,
      lastUpdated: this.lastUpdated,
      status: this.status,
      currentStation: this.currentStation
    };
  }

  static validate(data) {
    if (!data.lat || typeof data.lat !== 'number') {
      throw new Error('Latitude is required and must be a number');
    }

    if (!data.lng || typeof data.lng !== 'number') {
      throw new Error('Longitude is required and must be a number');
    }

    if (!data.color || typeof data.color !== 'string') {
      throw new Error('Color is required and must be a string');
    }
  }

  // Calculate if tram is within range of a station
  isWithinRange(stationLat, stationLng, rangeKm = 0.5) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(stationLat - this.lat);
    const dLon = this.toRad(stationLng - this.lng);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(this.lat)) * Math.cos(this.toRad(stationLat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance <= rangeKm;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
}

export default Tram; 