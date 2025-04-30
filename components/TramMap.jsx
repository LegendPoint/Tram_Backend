import React, { useEffect, useRef, useState } from 'react';
import tramService from '../services/tramService';
import './TramMap.css';

const TramMap = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map());
  const [tramPositions, setTramPositions] = useState([]);

  // Initialize map
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

  // Initialize tram tracking
  useEffect(() => {
    tramService.initializeTramTracking((positions) => {
      const positionsArray = Array.from(positions.values());
      setTramPositions(positionsArray);
      updateTramMarkers(positionsArray);
    });
  }, []);

  // Update tram markers on the map
  const updateTramMarkers = async (positions) => {
    if (!mapInstanceRef.current) return;

    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // Remove old markers that are no longer in positions
    markersRef.current.forEach((marker, id) => {
      if (!positions.find(pos => pos.id === id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    });

    // Update or create markers for current positions
    positions.forEach(position => {
      let marker = markersRef.current.get(position.id);
      
      if (!marker) {
        // Create new marker
        const markerView = new google.maps.marker.PinElement({
          background: this.getColorHex(position.color),
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          scale: 1.2
        });

        marker = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: { lat: position.lat, lng: position.lng },
          title: `Tram ${position.id} (${position.color})`,
          content: markerView.element
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 10px;">
              <h3>Tram ${position.id}</h3>
              <p>Color: ${position.color}</p>
              <p>Last Updated: ${new Date(position.lastUpdated).toLocaleString()}</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        markersRef.current.set(position.id, marker);
      } else {
        // Update existing marker position
        marker.position = { lat: position.lat, lng: position.lng };
      }
    });
  };

  // Get hex color for tram markers
  const getColorHex = (color) => {
    const colorMap = {
      'red': '#FF0000',
      'green': '#00FF00',
      'blue': '#0000FF',
      'yellow': '#FFFF00'
    };
    return colorMap[color.toLowerCase()] || '#808080';
  };

  return (
    <div className="tram-map-container">
      <div ref={mapRef} className="map"></div>
      <div className="tram-info">
        <h3>Active Trams</h3>
        <div className="tram-list">
          {tramPositions.map(tram => (
            <div key={tram.id} className="tram-item">
              <span className="tram-color" style={{ backgroundColor: getColorHex(tram.color) }}></span>
              <span>Tram {tram.id} ({tram.color})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TramMap; 