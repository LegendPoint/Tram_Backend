import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import { getStationsData, getStationById, importStationsData } from '../config/firebase';
import { deleteStation, updateStation } from '../config/admin';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stations, setStations] = useState([]);
  const [editingStation, setEditingStation] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useUserAuth();

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const data = await getStationsData();
        setStations(Object.entries(data).map(([id, station]) => ({ id, ...station })));
      } catch (err) {
        setError('Failed to fetch stations');
        console.error(err);
      }
    };

    fetchStations();
  }, []);

  const handleImport = async () => {
    try {
      setError(null);
      await importStationsData();
      // Refresh stations after import
      const data = await getStationsData();
      setStations(Object.entries(data).map(([id, station]) => ({ id, ...station })));
    } catch (err) {
      setError('Failed to import stations');
      console.error(err);
    }
  };

  const handleEdit = (station) => {
    setEditingStation({ ...station });
  };

  const handleSave = async () => {
    try {
      setError(null);
      await updateStation(editingStation.id, editingStation);
      // Refresh the specific station
      const updatedStation = await getStationById(editingStation.id);
      setStations(stations.map(s => 
        s.id === editingStation.id ? { id: editingStation.id, ...updatedStation } : s
      ));
      setEditingStation(null);
    } catch (err) {
      setError('Failed to update station');
      console.error(err);
    }
  };

  const handleDelete = async (stationId) => {
    if (window.confirm('Are you sure you want to delete this station?')) {
      try {
        setError(null);
        await deleteStation(stationId);
        setStations(stations.filter(s => s.id !== stationId));
      } catch (err) {
        setError('Failed to delete station');
        console.error(err);
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditingStation(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!user) {
    return <div className="admin-dashboard">Please log in to access the admin dashboard.</div>;
  }

  return (
    <div className="admin-dashboard">
      <h2>Station Management</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <button className="import-button" onClick={handleImport}>
        Import Stations from JSON
      </button>

      <div className="stations-list">
        {stations.map(station => (
          <div key={station.id} className="station-item">
            {editingStation?.id === station.id ? (
              <div className="station-edit-form">
                <input
                  name="nameEn"
                  value={editingStation.nameEn}
                  onChange={handleChange}
                  placeholder="English Name"
                />
                <input
                  name="nameTh"
                  value={editingStation.nameTh}
                  onChange={handleChange}
                  placeholder="Thai Name"
                />
                <input
                  name="lat"
                  type="number"
                  value={editingStation.lat}
                  onChange={handleChange}
                  placeholder="Latitude"
                />
                <input
                  name="lng"
                  type="number"
                  value={editingStation.lng}
                  onChange={handleChange}
                  placeholder="Longitude"
                />
                <div className="button-group">
                  <button onClick={handleSave}>Save</button>
                  <button onClick={() => setEditingStation(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="station-info">
                <h3>{station.nameEn}</h3>
                <p>{station.nameTh}</p>
                <p>Latitude: {station.lat}</p>
                <p>Longitude: {station.lng}</p>
                <div className="button-group">
                  <button onClick={() => handleEdit(station)}>Edit</button>
                  <button 
                    className="delete-button"
                    onClick={() => handleDelete(station.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard; 