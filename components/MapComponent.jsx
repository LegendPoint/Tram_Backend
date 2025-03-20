import React, { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

const MapComponent = ({ origin, destination }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const directionsRendererRef = useRef(null);
  const [stations, setStations] = useState([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Mahidol University coordinates
  const mahidolCenter = { lat: 13.7949357, lng: 100.3188312 };
  const defaultZoom = 15;

  // Initialize map when component mounts
  useEffect(() => {
    const initializeMap = () => {
      if (!window.google || !mapRef.current) return;

      const mapOptions = {
        center: mahidolCenter,
        zoom: defaultZoom,
        mapId: 'YOUR_MAP_ID',
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU,
          position: window.google.maps.ControlPosition.TOP_RIGHT
        },
        zoomControl: true,
        zoomControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_CENTER
        },
        streetViewControl: true,
        streetViewControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_BOTTOM
        },
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: window.google.maps.ControlPosition.RIGHT_TOP
        }
      };

      const map = new window.google.maps.Map(mapRef.current, mapOptions);
      mapInstanceRef.current = map;

      // Add a loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'map-loading';
      loadingDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      loadingDiv.style.padding = '10px';
      loadingDiv.style.borderRadius = '4px';
      loadingDiv.style.position = 'absolute';
      loadingDiv.style.top = '10px';
      loadingDiv.style.left = '50%';
      loadingDiv.style.transform = 'translateX(-50%)';
      loadingDiv.style.zIndex = '1000';
      loadingDiv.innerHTML = 'Loading stations...';
      map.controls[window.google.maps.ControlPosition.TOP_CENTER].push(loadingDiv);

      setIsMapLoaded(true);
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

    return () => {
      cleanupMap();
    };
  }, []);

  // Cleanup function for markers and directions
  const cleanupMap = () => {
    if (markersRef.current) {
      markersRef.current.forEach(marker => {
        if (marker) marker.map = null;
      });
      markersRef.current = [];
    }
    
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
  };

  // Fetch and display stations
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    const database = getDatabase();
    const stationsRef = ref(database, 'stations');

    const unsubscribe = onValue(stationsRef, async (snapshot) => {
      try {
        // Remove loading indicator if it exists
        const loadingElements = mapInstanceRef.current.controls[window.google.maps.ControlPosition.TOP_CENTER].getArray();
        loadingElements.forEach(element => {
          if (element.className === 'map-loading') {
            mapInstanceRef.current.controls[window.google.maps.ControlPosition.TOP_CENTER].removeAt(0);
          }
        });

        if (snapshot.exists()) {
          const stationsData = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            ...data
          }));
          setStations(stationsData);

          // Set initial map bounds to show all stations area
          if (!origin && !destination && stationsData.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            stationsData.forEach(station => {
              bounds.extend({ lat: station.lat, lng: station.lng });
            });
            mapInstanceRef.current.fitBounds(bounds);
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            mapInstanceRef.current.fitBounds(bounds, padding);
          }
        }
      } catch (error) {
        console.error('Error loading stations:', error);
      }
    });

    return () => unsubscribe();
  }, [isMapLoaded, origin, destination]);

  // Handle route display
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    if (origin && destination) {
      cleanupMap();

      const createMarker = async (station, isOrigin) => {
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        
        const markerView = new google.maps.marker.PinElement({
          background: isOrigin ? "#4CAF50" : "#F44336",
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          scale: 1.2
        });

        const marker = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: { lat: station.lat, lng: station.lng },
          title: station.nameEn,
          content: markerView.element
        });

        markersRef.current.push(marker);
      };

      createMarker(origin, true);
      createMarker(destination, false);

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2196F3',
          strokeWeight: 4
        }
      });

      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(result);
            
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend({ lat: origin.lat, lng: origin.lng });
            bounds.extend({ lat: destination.lat, lng: destination.lng });
            mapInstanceRef.current.fitBounds(bounds);
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            mapInstanceRef.current.fitBounds(bounds, padding);
          }
        }
      );
    }
  }, [origin, destination, isMapLoaded]);

  return (
    <div 
      ref={mapRef} 
      style={{ 
        width: '100%',
        height: '100%',
        minHeight: '600px',
        position: 'absolute',
        top: 0,
        left: 0,
        borderRadius: '8px',
        overflow: 'hidden'
      }} 
    />
  );
};

export default MapComponent; 