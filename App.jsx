import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserAuth } from './context/UserAuthContext'
import MapComponent from './components/MapComponent'
import StationSelector from './components/StationSelector'
import { getDatabase, ref, push } from 'firebase/database'
import './App.css'

function App() {
  const { user, logout } = useUserAuth();
  const navigate = useNavigate();
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');

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
            <button 
              className="feedback-button"
              onClick={() => setShowFeedback(true)}
            >
              Give Feedback
            </button>
          </div>

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
    </div>
  )
}

export default App
