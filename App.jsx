import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserAuth } from './context/UserAuthContext'
import MapComponent from './components/MapComponent'
import StationSelector from './components/StationSelector'
import './App.css'

function App() {
  const { user, logout } = useUserAuth();
  const navigate = useNavigate();
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('App: Current user state:', user ? 'Logged in' : 'Not logged in');
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleRestrictedAccess = () => {
    if (!user) {
      alert('Please log in to access the admin dashboard');
      navigate('/login');
      return;
    }
    navigate('/dashboard');
  };

  // Debug function for station selection
  const handleOriginSelect = (station) => {
    console.log('Origin station selected:', station);
    setSelectedOrigin(station);
  };

  const handleDestinationSelect = (station) => {
    console.log('Destination station selected:', station);
    setSelectedDestination(station);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Tram Simulation</h1>
        <div className="header-right">
          {user ? (
            <div className="user-info">
              <span>Logged in as: {user.email}</span>
              <button className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <button className="login-button" onClick={() => navigate('/login')}>
              Login
            </button>
          )}
        </div>
      </header>
      <main className="App-main">
        <div className="content-wrapper">
          <div className="map-section">
            <StationSelector 
              onOriginSelect={handleOriginSelect}
              onDestinationSelect={handleDestinationSelect}
            />
            <div className="map-container">
              <MapComponent 
                origin={selectedOrigin}
                destination={selectedDestination}
              />
            </div>
          </div>
          
          <div className="button-container">
            <button 
              className="restricted-button"
              onClick={handleRestrictedAccess}
            >
              Access Admin Dashboard
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App