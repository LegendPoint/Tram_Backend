import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { getDatabase, ref, onValue, remove } from 'firebase/database';
import AddEvent from './AddEvent';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [events, setEvents] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useUserAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const db = getDatabase();
        const eventsRef = ref(db, 'events');
        onValue(eventsRef, (snapshot) => {
          if (snapshot.exists()) {
            const eventsData = Object.entries(snapshot.val()).map(([id, event]) => ({
              id,
              ...event
            }));
            setEvents(eventsData);
          } else {
            setEvents([]);
          }
        });
      } catch (err) {
        setError('Failed to fetch events');
        console.error(err);
      }
    };

    fetchEvents();
  }, []);

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        const db = getDatabase();
        const eventRef = ref(db, `events/${eventId}`);
        await remove(eventRef);
      } catch (err) {
        setError('Failed to delete event');
        console.error(err);
      }
    }
  };

  if (!user) {
    return <div className="admin-dashboard">Please log in to access the admin dashboard.</div>;
  }

  return (
    <div className="admin-dashboard">
      <button 
        className="back-button"
        onClick={() => navigate('/')}
      >
        Back to Home
      </button>

      <header className="dashboard-header">
        <h1>Event Management</h1>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="event-controls">
        <button 
          className="add-event-button"
          onClick={() => setShowAddEvent(true)}
        >
          Add New Event
        </button>
      </div>

      {showAddEvent && (
        <div className="modal-overlay">
          <AddEvent onClose={() => setShowAddEvent(false)} />
        </div>
      )}

      <div className="events-list">
        {events.map(event => (
          <div key={event.id} className="event-card">
            <h3>{event.name}</h3>
            <p>{event.description}</p>
            <div className="event-details">
              <p>Start: {new Date(event.startDate).toLocaleString()}</p>
              <p>End: {new Date(event.endDate).toLocaleString()}</p>
              <p>Location: {event.location.lat.toFixed(6)}, {event.location.lng.toFixed(6)}</p>
            </div>
            <button 
              className="delete-button"
              onClick={() => handleDeleteEvent(event.id)}
            >
              Delete Event
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard; 