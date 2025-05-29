import React, { useState, useEffect } from 'react';
import { getAllStationNames } from '../config/firebase';

const StationDropdown = ({ onSelect, selectedValue, label, placeholder }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to station names updates
    const unsubscribe = getAllStationNames((stationsList) => {
      setStations(stationsList);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleChange = (event) => {
    const selectedStation = stations.find(station => station.key === event.target.value);
    onSelect(selectedStation);
  };

  if (loading) {
    return <div>Loading stations...</div>;
  }

  return (
    <div className="station-dropdown">
      {label && <label htmlFor="station-select">{label}</label>}
      <select
        id="station-select"
        value={selectedValue || ''}
        onChange={handleChange}
        className="station-select"
      >
        <option value="">{placeholder || 'Select a station'}</option>
        {stations.map((station) => (
          <option key={station.key} value={station.key}>
            {station.nameEn} - {station.nameTh}
          </option>
        ))}
      </select>
    </div>
  );
};

export default StationDropdown; 