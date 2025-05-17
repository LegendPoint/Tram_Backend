import React, { useState, useEffect } from 'react'
import { useNavigate, Routes, Route } from 'react-router-dom'
import { useUserAuth } from './context/UserAuthContext'
import MapComponent from './components/MapComponent'
import StationSelector from './components/StationSelector'
import RouteInfo from './components/RouteInfo'
import { getDatabase, ref, push } from 'firebase/database'
import MergedRouteEditor from './components/MergedRouteEditor'
import './App.css'

function App() {
  const { user, logout } = useUserAuth();
  const navigate = useNavigate();
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [routeInfo, setRouteInfo] = useState({
    walking: { distance: '', duration: '' },
    driving: { distance: '', duration: '' },
    total: { distance: '', duration: '' }
  });

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

  const handleOriginSelect = (station) => {
    setSelectedOrigin(station);
  };

  const handleDestinationSelect = (station) => {
    setSelectedDestination(station);
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackMessage.trim()) {
      alert('Please enter your message.');
      return;
    }

    try {
      const db = getDatabase();
      const feedbackRef = ref(db, 'feedback');
      await push(feedbackRef, {
        email: feedbackEmail || 'Anonymous',
        message: feedbackMessage,
        timestamp: new Date().toISOString()
      });
      setFeedbackMessage('');
      setFeedbackEmail('');
      setShowFeedback(false);
      alert('Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback.');
    }
  };

  // Function to convert distance string to kilometers
  const convertToKm = (distanceStr) => {
    if (!distanceStr) return 0;
    // Match both English and Thai units (km, กม, m, ม)
    const match = distanceStr.match(/(\d+\.?\d*)\s*(km|กม|m|ม)/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2];
    // Convert to km if the unit is meters (m or ม)
    return (unit === 'm' || unit === 'ม') ? value / 1000 : value;
  };

  // Function to convert duration string to minutes
  const convertToMinutes = (durationStr) => {
    if (!durationStr) return 0;
    // Match both English and Thai time units
    const match = durationStr.match(/(?:(\d+)\s*(?:hour|hr|ชั่วโมง)(?:s)?)?\s*(?:(\d+)\s*(?:min|minute|นาที)(?:s)?)?/);
    if (!match) return 0;
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    return hours * 60 + minutes;
  };

  // Function to format duration display
  const formatDuration = (durationStr) => {
    if (!durationStr) return '';
    const totalMinutes = convertToMinutes(durationStr);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) {
      return `${minutes} min`;
    } else if (minutes === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${minutes} min`;
    }
  };

  // Function to format total distance
  const formatTotalDistance = (walkingDist, drivingDist) => {
    if (selectedOrigin?.currentLocation) {
      const totalKm = convertToKm(walkingDist) + convertToKm(drivingDist);
      return `${totalKm.toFixed(1)} km`;
    } else {
      return formatDistance(drivingDist);
    }
  };

  // Function to format total duration
  const formatTotalDuration = (walkingDur, drivingDur) => {
    if (selectedOrigin?.currentLocation) {
      const totalMinutes = convertToMinutes(walkingDur) + convertToMinutes(drivingDur);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      if (hours === 0) {
        return `${minutes} min`;
      } else if (minutes === 0) {
        return `${hours} hr`;
      } else {
        return `${hours} hr ${minutes} min`;
      }
    } else {
      return formatDuration(drivingDur);
    }
  };

  // Function to standardize distance display
  const formatDistance = (distanceStr) => {
    if (!distanceStr) return '';
    const km = convertToKm(distanceStr);
    return `${km.toFixed(1)} km`;
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
      <Routes>
        <Route path="/editroutes" element={<MergedRouteEditor />} />
        <Route path="*" element={
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
                    onRouteInfoUpdate={setRouteInfo}
                  />
                </div>
              </div>
              {/* <div className="route-info-section">
                <RouteInfo routeName="Red" />
                <RouteInfo routeName="Green" />
                <RouteInfo routeName="Blue" />
              </div> */}
              <div className="button-container">
                <button 
                  className="restricted-button"
                  onClick={handleRestrictedAccess}
                >
                  Access Admin Dashboard
                </button>
                <button 
                  className="feedback-button"
                  onClick={() => setShowFeedback(true)}
                >
                  Give Feedback
                </button>
              </div>

              {(routeInfo.tramToStart?.distance || routeInfo.startToEnd?.distance || routeInfo.startToTransfer?.distance) && (
                <div className="route-info-container">
                  {/* Direct or transfer: Tram to Origin Station */}
                  {routeInfo.tramToStart?.distance && (
                    <div className="route-info-section">
                      <h3>
                        {routeInfo.tramToStart.color && (
                          <span style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            backgroundColor: routeInfo.tramToStart.color,
                            borderRadius: '50%',
                            marginRight: 8,
                            border: '1px solid #888',
                            verticalAlign: 'middle'
                          }}></span>
                        )}
                        {routeInfo.tramToStart.color ? `${capitalize(routeInfo.tramToStart.color)} Tram to Origin Station` : 'Tram to Origin Station'}
                      </h3>
                      <p>Distance: {routeInfo.tramToStart.distance}</p>
                      <p>Duration: {routeInfo.tramToStart.duration}</p>
                    </div>
                  )}
                  {/* Transfer: Origin to Transfer Station */}
                  {routeInfo.startToTransfer?.distance && (
                    <div className="route-info-section">
                      <h3>
                        {routeInfo.startToTransfer.color && (
                          <span style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            backgroundColor: routeInfo.startToTransfer.color,
                            borderRadius: '50%',
                            marginRight: 8,
                            border: '1px solid #888',
                            verticalAlign: 'middle'
                          }}></span>
                        )}
                        {routeInfo.startToTransfer.color ? `${capitalize(routeInfo.startToTransfer.color)} Tram: Origin to Transfer Station` : 'Origin to Transfer Station'}
                      </h3>
                      <p>Distance: {routeInfo.startToTransfer.distance}</p>
                      <p>Duration: {routeInfo.startToTransfer.duration}</p>
                      {routeInfo.transferStation && <p>Transfer Station: <b>{routeInfo.transferStation}</b></p>}
                    </div>
                  )}
                  {/* Transfer: Tram to Transfer Station */}
                  {routeInfo.tramToTransfer?.distance && (
                    <div className="route-info-section">
                      <h3>
                        {routeInfo.tramToTransfer.color && (
                          <span style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            backgroundColor: routeInfo.tramToTransfer.color,
                            borderRadius: '50%',
                            marginRight: 8,
                            border: '1px solid #888',
                            verticalAlign: 'middle'
                          }}></span>
                        )}
                        {routeInfo.tramToTransfer.color ? `${capitalize(routeInfo.tramToTransfer.color)} Tram to Transfer Station` : 'Tram to Transfer Station'}
                      </h3>
                      <p>Distance: {routeInfo.tramToTransfer.distance}</p>
                      <p>Duration: {routeInfo.tramToTransfer.duration}</p>
                    </div>
                  )}
                  {/* Transfer: Transfer Station to Destination */}
                  {routeInfo.transferToEnd?.distance && (
                    <div className="route-info-section">
                      <h3>
                        {routeInfo.transferToEnd.color && (
                          <span style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            backgroundColor: routeInfo.transferToEnd.color,
                            borderRadius: '50%',
                            marginRight: 8,
                            border: '1px solid #888',
                            verticalAlign: 'middle'
                          }}></span>
                        )}
                        {routeInfo.transferToEnd.color ? `Transfer Station to Destination (${capitalize(routeInfo.transferToEnd.color)} Tram)` : 'Transfer Station to Destination'}
                      </h3>
                      <p>Distance: {routeInfo.transferToEnd.distance}</p>
                      <p>Duration: {routeInfo.transferToEnd.duration}</p>
                    </div>
                  )}
                  {/* Direct: Origin to Destination */}
                  {routeInfo.startToEnd?.distance && !routeInfo.startToTransfer && (
                    <div className="route-info-section">
                      <h3>
                        {routeInfo.startToEnd.color && (
                          <span style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            backgroundColor: routeInfo.startToEnd.color,
                            borderRadius: '50%',
                            marginRight: 8,
                            border: '1px solid #888',
                            verticalAlign: 'middle'
                          }}></span>
                        )}
                        {routeInfo.startToEnd.color ? `Origin to Destination (${capitalize(routeInfo.startToEnd.color)} Tram)` : 'Origin to Destination'}
                      </h3>
                      <p>Distance: {routeInfo.startToEnd.distance}</p>
                      <p>Duration: {routeInfo.startToEnd.duration}</p>
                    </div>
                  )}
                  {/* Total Journey */}
                  {routeInfo.total?.distance && (
                    <div className="route-info-section total">
                      <h3>{routeInfo.total.label || 'Total Journey'}</h3>
                      <p>Total Distance: {routeInfo.total.distance}</p>
                      <p>Total Duration: {routeInfo.total.duration}</p>
                    </div>
                  )}
                </div>
              )}

              {showFeedback && (
                <div className="feedback-popup">
                  <input
                    type="email"
                    placeholder="Your email (optional)"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                  />
                  <textarea 
                    placeholder="Enter your feedback here..." 
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                  />
                  <div className="feedback-actions">
                    <button className="confirm-btn" onClick={handleFeedbackSubmit}>Submit</button>
                    <button className="cancel-btn" onClick={() => setShowFeedback(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </main>
        } />
      </Routes>
    </div>
  )
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default App