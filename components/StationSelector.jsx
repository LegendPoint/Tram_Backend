import React, { useState, useEffect } from 'react';
import { getStationsData } from '../config/firebase';
import { findNearestTramStop } from '../utils/stations';

const StationSelector = ({ onOriginSelect, onDestinationSelect }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearestStation, setNearestStation] = useState(null);

  useEffect(() => {
    const fetchStations = () => {
      setLoading(true);
      const unsubscribe = getStationsData((stationsData) => {
        console.log('Fetched stations:', stationsData);
        setStations(stationsData);
        setLoading(false);
      });

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    };

    fetchStations();
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          id: 'current',
          nameEn: 'Current Location',
          nameTh: 'ตำแหน่งปัจจุบัน',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          colors: ['Current']
        };
        setCurrentLocation(location);
        
        // Find nearest tram stop
        const nearest = findNearestTramStop(location, stations);
        setNearestStation(nearest);
        
        // Notify parent component about the route points
        if (nearest) {
          onOriginSelect({
            currentLocation: location,
            nearestStation: nearest
          });
        }
      },
      (error) => {
        setLocationError('Unable to retrieve your location');
        console.error('Geolocation error:', error);
      }
    );
  };

  const handleOriginChange = (event) => {
    const selectedId = event.target.value;
    if (selectedId === 'current') {
      getCurrentLocation();
    } else {
      // Clear current location and nearest station when selecting a different origin
      setCurrentLocation(null);
      setNearestStation(null);
      const station = stations.find(s => s.id.toString() === selectedId.toString());
      console.log('Selected origin station:', station);
      if (station) {
        onOriginSelect({ station });
      }
    }
  };

  const handleDestinationChange = (event) => {
    const selectedId = event.target.value;
    const station = stations.find(s => s.id.toString() === selectedId.toString());
    console.log('Selected destination station:', station);
    if (station) {
      onDestinationSelect(station);
    }
  };

  if (loading) {
    return <div>Loading stations...</div>;
  }

  if (error) {
    return <div>Error loading stations: {error.message}</div>;
  }

  return (
    <div className="station-selector">
      <div className="selector-container">
        <select 
          id="origin" 
          onChange={handleOriginChange}
          className="station-select"
          aria-label="Select origin station"
        >
          <option value="">From: Select origin station</option>
          <option value="current">Current Location</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.nameEn} ({station.nameTh})
            </option>
          ))}
        </select>

        <select 
          id="destination" 
          onChange={handleDestinationChange}
          className="station-select"
          aria-label="Select destination station"
        >
          <option value="">To: Select destination station</option>
          {stations.map((station) => (
            <option key={station.id} value={station.id}>
              {station.nameEn} ({station.nameTh})
            </option>
          ))}
        </select>
      </div>

      {locationError && (
        <div className="location-error">
          {locationError}
        </div>
      )}

      {currentLocation && nearestStation && (
        <div className="nearest-station-info">
          Nearest tram stop: {nearestStation.nameEn} ({nearestStation.nameTh})
        </div>
      )}

      {/* Debug section (hidden) */}
      <div style={{ display: 'none' }}>
        <pre>
          {JSON.stringify(stations, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default StationSelector; 