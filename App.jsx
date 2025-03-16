import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserAuth } from './context/UserAuthContext'
import './App.css'

function App() {
  const { user, logout } = useUserAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestrictedAccess = () => {
    if (!user) {
      alert('Please log in to access this feature');
      navigate('/login');
      return;
    }
    navigate('/dashboard');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Tram Simulation</h1>
        {user && (
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>
      <main className="App-main">
        <div className="home-section">
          <h2>Welcome to Tram Simulation</h2>
          <p>Your one-stop solution for tram route planning and simulation</p>
          
          <div className="button-container">
            {!user ? (
              <button 
                className="login-button"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
            ) : (
              <button 
                className="logout-button"
                onClick={handleLogout}
              >
                Logout
              </button>
            )}
            
            <button 
              className="restricted-button"
              onClick={handleRestrictedAccess}
            >
              Access Dashboard
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App