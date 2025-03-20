import React, { useState, useEffect } from 'react';
import { getStationsData } from '../config/firebase';

const StationSelector = ({ onOriginSelect, onDestinationSelect }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStations = () => {
      setLoading(true);
      const unsubscribe = getStationsData((stationsData) => {
        console.log('Fetched stations:', stationsData); // Debug log
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

  const handleOriginChange = (event) => {
    const station = stations.find(s => s.id === event.target.value);
    console.log('Selected origin station:', station); // Debug log
    onOriginSelect(station);
  };

  const handleDestinationChange = (event) => {
    const station = stations.find(s => s.id === event.target.value);
    console.log('Selected destination station:', station); // Debug log
    onDestinationSelect(station);
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