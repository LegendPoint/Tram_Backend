// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Find the nearest tram stop from a given location
export const findNearestTramStop = (currentLocation, stations) => {
  if (!currentLocation || !stations || stations.length === 0) return null;

  let nearestStation = null;
  let minDistance = Infinity;

  stations.forEach(station => {
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      station.lat,
      station.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = station;
    }
  });

  return nearestStation;
}; 