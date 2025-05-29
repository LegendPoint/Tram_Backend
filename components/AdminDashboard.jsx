import React, { useState, useEffect, useRef } from 'react';
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
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [editEventData, setEditEventData] = useState(null);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editError, setEditError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const editMapRef = useRef(null);
  const editMapInstanceRef = useRef(null);
  const editMarkerRef = useRef(null);
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

  useEffect(() => {
    if (showEditEvent && window.google && window.google.maps && editEventData && editEventData.location) {
      // Only initialize map and marker once
      if (!editMapRef.current) return;
      if (!editMapInstanceRef.current) {
        const mapOptions = {
          center: { lat: editEventData.location.lat, lng: editEventData.location.lng },
          zoom: 15,
          mapId: 'YOUR_MAP_ID',
          mapTypeControl: true,
          zoomControl: true,
          streetViewControl: true,
          fullscreenControl: true
        };
        editMapInstanceRef.current = new window.google.maps.Map(editMapRef.current, mapOptions);
        // Place marker
        editMarkerRef.current = new window.google.maps.Marker({
          position: { lat: editEventData.location.lat, lng: editEventData.location.lng },
          map: editMapInstanceRef.current,
          draggable: true
        });
        // On marker drag
        editMarkerRef.current.addListener('dragend', (e) => {
          const newLocation = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          };
          setEditEventData(prev => ({ ...prev, location: newLocation }));
        });
        // On map click
        editMapInstanceRef.current.addListener('click', (e) => {
          const newLocation = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          };
          editMarkerRef.current.setPosition(newLocation);
          setEditEventData(prev => ({ ...prev, location: newLocation }));
        });
        setMapLoaded(true);
      }
    }
    // Cleanup map on modal close
    return () => {
      if (!showEditEvent) {
        if (editMarkerRef.current) {
          editMarkerRef.current.setMap(null);
          editMarkerRef.current = null;
        }
        if (editMapInstanceRef.current) {
          editMapInstanceRef.current = null;
        }
        setMapLoaded(false);
      }
    };
  }, [showEditEvent]);

  // Update marker position when location changes (but don't recreate map/marker)
  useEffect(() => {
    if (showEditEvent && editMarkerRef.current && editEventData && editEventData.location) {
      editMarkerRef.current.setPosition(editEventData.location);
      if (editMapInstanceRef.current) {
        editMapInstanceRef.current.panTo(editEventData.location);
      }
    }
  }, [editEventData?.location, showEditEvent]);

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

  const handleEditEvent = (event) => {
    setEditEventData(event);
    setEditImageFile(null);
    setShowEditEvent(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError(null);
    try {
      await eventService.updateEventWithImage(editEventData.id, editEventData, editImageFile);
      setShowEditEvent(false);
      setEditEventData(null);
      setEditImageFile(null);
    } catch (error) {
      setEditError(error.message || 'Failed to update event.');
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

      {showEditEvent && (
        <div className="modal-overlay">
          <div className="add-event-container">
            <h2>Edit Event</h2>
            {editError && <div className="error-message">{editError}</div>}
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label htmlFor="edit-name">Event Name</label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={editEventData?.name || ''}
                  onChange={e => setEditEventData({ ...editEventData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-description">Description</label>
                <textarea
                  id="edit-description"
                  name="description"
                  value={editEventData?.description || ''}
                  onChange={e => setEditEventData({ ...editEventData, description: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-startDate">Start Date</label>
                <input
                  type="datetime-local"
                  id="edit-startDate"
                  name="startDate"
                  value={editEventData?.startDate || ''}
                  onChange={e => setEditEventData({ ...editEventData, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-endDate">End Date</label>
                <input
                  type="datetime-local"
                  id="edit-endDate"
                  name="endDate"
                  value={editEventData?.endDate || ''}
                  onChange={e => setEditEventData({ ...editEventData, endDate: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <div className="map-container">
                  <div ref={editMapRef} className="map" style={{ width: '100%', height: '300px' }}></div>
                </div>
                {editEventData?.location && (
                  <p className="location-info">
                    Selected location: {editEventData.location.lat.toFixed(6)}, {editEventData.location.lng.toFixed(6)}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label>Current Image</label>
                {editEventData?.imageUrl ? (
                  <img src={editEventData.imageUrl} alt="Event" style={{ maxWidth: 200, marginBottom: 8 }} />
                ) : (
                  <span>No image</span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="edit-image">Replace Image</label>
                <input
                  type="file"
                  id="edit-image"
                  accept="image/*"
                  onChange={e => setEditImageFile(e.target.files[0])}
                />
              </div>
              <div className="button-group">
                <button type="submit" className="submit-button">Save Changes</button>
                <button type="button" className="cancel-button" onClick={() => setShowEditEvent(false)}>Cancel</button>
              </div>
            </form>
          </div>
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
                {event.location && (
                  <p>Location: {event.location.lat.toFixed(6)}, {event.location.lng.toFixed(6)}</p>
                )}
              </div>
              <button 
                className="delete-button"
                onClick={() => handleDeleteEvent(event.id)}
              >
                Delete Event
              </button>
              <button className="add-event-button" onClick={() => handleEditEvent(event)}>Edit Event</button>
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
                {event.location && (
                  <p>Location: {event.location.lat.toFixed(6)}, {event.location.lng.toFixed(6)}</p>
                )}
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
