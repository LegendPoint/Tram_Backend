import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import eventService from '../services/eventService';
import feedbackService from '../services/feedbackService';
import AddEvent from './AddEvent';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [events, setEvents] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useUserAuth();
  const navigate = useNavigate();

  // Separate events into active and history
  const activeEvents = events.filter(event => new Date(event.endDate) > new Date());
  const historyEvents = events.filter(event => new Date(event.endDate) <= new Date());

  useEffect(() => {
    const unsubscribeEvents = eventService.getAllEvents((eventsData) => {
      setEvents(eventsData);
    });

    const unsubscribeFeedback = feedbackService.getAllFeedback((feedbackData) => {
      setFeedback(feedbackData);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeFeedback();
    };
  }, []);

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await eventService.deleteEvent(eventId);
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Failed to delete event. Please try again.');
      }
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (window.confirm('Are you sure you want to delete this feedback?')) {
      try {
        await feedbackService.deleteFeedback(feedbackId);
      } catch (error) {
        console.error('Error deleting feedback:', error);
        alert('Failed to delete feedback. Please try again.');
      }
    }
  };

  const handleDeleteAllFeedback = async () => {
    if (window.confirm('Are you sure you want to delete all feedback?')) {
      try {
        await feedbackService.deleteAllFeedback();
      } catch (error) {
        console.error('Error deleting all feedback:', error);
        alert('Failed to delete all feedback. Please try again.');
      }
    }
  };

  if (!user) {
    return (
      <div className="admin-dashboard">
        <p>Please log in to access the admin dashboard.</p>
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <button 
        className="back-button"
        onClick={() => navigate('/')}
      >
        Back to Home
      </button>

      <button 
        className="restricted-button"
        style={{ marginLeft: 12, marginBottom: 16 }}
        onClick={() => navigate('/editroutes')}
      >
        Edit Routes
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

        <button 
          className="feedback-button"
          onClick={() => navigate('/feedback')}
        >
          View Feedback
        </button>
      </div>

      {showAddEvent && (
        <div className="modal-overlay">
          <AddEvent onClose={() => setShowAddEvent(false)} />
        </div>
      )}

      {/* Normal Events Section */}
      <div className="events-section">
        <h2>Normal Events</h2>
      <div className="events-list">
          {activeEvents.map(event => (
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
          {activeEvents.length === 0 && (
            <p className="no-events">No active events found.</p>
          )}
        </div>
      </div>

      {/* History Section */}
      <div className="events-section history-section">
        <h2>History</h2>
        <div className="events-list">
          {historyEvents.map(event => (
            <div key={event.id} className="event-card history-card">
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
          {historyEvents.length === 0 && (
            <p className="no-events">No past events found.</p>
          )}
        </div>
      </div>

      {/* Route Editor Section */}
      {/* <div className="route-editor-section">
        <h2>Route Editor</h2>
        <AdminRouteEditor />
      </div> */}
    </div>
  );
};

export default AdminDashboard;
