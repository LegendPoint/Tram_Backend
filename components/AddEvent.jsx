import React, { useState, useEffect, useRef } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import eventService from '../services/eventService';
import Event from '../models/eventModel';
import './AddEvent.css';

const AddEvent = ({ onClose }) => {
  const { user } = useUserAuth();
  const [eventData, setEventData] = useState({
    name: '',
    description: '',
    location: null,
    startDate: '',
    endDate: '',
    status: 'active'
  });
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize map when component mounts
  useEffect(() => {
    const initializeMap = () => {
      if (!window.google || !mapRef.current) return;

      const mapOptions = {
        center: { lat: 13.7949357, lng: 100.3188312 }, // Mahidol University center
        zoom: 15,
        mapId: 'YOUR_MAP_ID',
        mapTypeControl: true,
        zoomControl: true,
        streetViewControl: true,
        fullscreenControl: true
      };

      const map = new window.google.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map;

      // Add click listener to place marker
      map.addListener('click', (e) => {
        const location = {
          lat: e.latLng.lat(),
          lng: e.latLng.lng()
        };

        // Remove existing marker if any
        if (markerRef.current) {
          markerRef.current.setMap(null);
        }

        // Create new marker
        markerRef.current = new window.google.maps.Marker({
          position: location,
          map: map,
          draggable: true
        });

        // Update event data with new location
        setEventData(prev => ({
          ...prev,
          location: location
        }));

        // Add drag listener to update location
        markerRef.current.addListener('dragend', (e) => {
          const newLocation = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          };
          setEventData(prev => ({
            ...prev,
            location: newLocation
          }));
        });
      });
    };

    if (window.google && window.google.maps) {
      initializeMap();
    } else {
      const handleMapsLoaded = () => {
        initializeMap();
      };
      window.addEventListener('google-maps-loaded', handleMapsLoaded);
      return () => {
        window.removeEventListener('google-maps-loaded', handleMapsLoaded);
      };
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Validate event data using the Event model
      Event.validate(eventData);

      // Create event using the event service
      await eventService.createEvent(eventData, user.uid);
      
      alert('Event added successfully!');
      onClose();
    } catch (error) {
      console.error('Error adding event:', error);
      setError(error.message || 'Failed to add event. Please try again.');
    }
  };

  return (
    <div className="add-event-container">
      <h2>Add New Event</h2>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Event Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={eventData.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={eventData.description}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="startDate">Start Date</label>
          <input
            type="datetime-local"
            id="startDate"
            name="startDate"
            value={eventData.startDate}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input
            type="datetime-local"
            id="endDate"
            name="endDate"
            value={eventData.endDate}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Location</label>
          <div className="map-container">
            <div ref={mapRef} className="map"></div>
          </div>
          {eventData.location && (
            <p className="location-info">
              Selected location: {eventData.location.lat.toFixed(6)}, {eventData.location.lng.toFixed(6)}
            </p>
          )}
        </div>

        <div className="button-group">
          <button type="submit" className="submit-button">Add Event</button>
          <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default AddEvent; 