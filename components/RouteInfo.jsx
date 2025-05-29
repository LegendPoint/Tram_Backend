import React, { useState, useEffect } from 'react';
import { getStationsByRoute } from '../config/firebase';

const RouteInfo = ({ routeName }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRouteStations = async () => {
      try {
        setLoading(true);
        const routeStations = await getStationsByRoute(routeName);
        if (Array.isArray(routeStations)) {
          // Add position information to each station
          const stationsWithPosition = routeStations.map((station, index) => ({
            ...station,
            position: index + 1
          }));
          setStations(stationsWithPosition);
        } else {
          setStations([]);
        }
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setStations([]);
      }
    };

    fetchRouteStations();
  }, [routeName]);

  if (loading) {
    return <div className="loading-message">Loading {routeName} line stations...</div>;
  }

  if (error) {
    return <div className="error-message">Error loading {routeName} line: {error}</div>;
  }

  if (!stations || stations.length === 0) {
    return <div className="no-stations-message">No stations found for {routeName} line</div>;
  }

  return (
    <div className="route-info">
      <h2>{routeName} Line Stations</h2>
      <div className="stations-list">
        {stations.map((station) => (
          <div key={`${station.id}-${station.position}`} className="station-item">
            <span className="station-number">Stop {station.position}</span>
            <div className="station-details">
              <h3>{station.nameEn}</h3>
              <p>{station.nameTh}</p>
              <p>Station ID: {station.id}</p>
              <p>Coordinates: {station.lat}, {station.lng}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteInfo; 