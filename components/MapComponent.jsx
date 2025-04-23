import React, { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

const MapComponent = ({ origin, destination, onRouteInfoUpdate }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const eventMarkersRef = useRef([]);
  const polylinesRef = useRef([]); // Store polylines for cleanup
  const [stations, setStations] = useState([]);
  const [events, setEvents] = useState([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const mahidolCenter = { lat: 13.7949357, lng: 100.3188312 };
  const defaultZoom = 15;

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
      const handleMapsLoaded = () => initializeMap();
      window.addEventListener('google-maps-loaded', handleMapsLoaded);
      return () => {
        window.removeEventListener('google-maps-loaded', handleMapsLoaded);
      };
    }

    return () => {
      cleanupMap();
    };
  }, []);

  const cleanupMap = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    eventMarkersRef.current.forEach(marker => marker.setMap(null));
    eventMarkersRef.current = [];

    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
  };

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    const database = getDatabase();
    const stationsRef = ref(database, 'stations');

    const unsubscribe = onValue(stationsRef, async (snapshot) => {
      try {
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

          if (!origin && !destination && stationsData.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            stationsData.forEach(station => {
              bounds.extend({ lat: station.lat, lng: station.lng });
            });
            mapInstanceRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
          }
        }
      } catch (error) {
        console.error('Error loading stations:', error);
      }
    });

    return () => unsubscribe();
  }, [isMapLoaded, origin, destination]);

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    const database = getDatabase();
    const eventsRef = ref(database, 'events');

    const unsubscribe = onValue(eventsRef, async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const eventsData = Object.entries(snapshot.val()).map(([id, data]) => ({
            id,
            ...data
          }));
          setEvents(eventsData);

          eventMarkersRef.current.forEach(marker => marker.setMap(null));
          eventMarkersRef.current = [];

          const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
          eventsData.forEach(event => {
            if (event.location) {
              const markerView = new google.maps.marker.PinElement({
                background: "#9C27B0",
                borderColor: "#ffffff",
                glyphColor: "#ffffff",
                scale: 1.2
              });

              const marker = new AdvancedMarkerElement({
                map: mapInstanceRef.current,
                position: { lat: event.location.lat, lng: event.location.lng },
                title: event.name,
                content: markerView.element
              });

              marker.addListener('click', () => {
                const infoWindow = new google.maps.InfoWindow({
                  content: `
                    <div style="padding: 10px;">
                      <h3>${event.name}</h3>
                      <p>${event.description}</p>
                      <p>Start: ${new Date(event.startDate).toLocaleString()}</p>
                      <p>End: ${new Date(event.endDate).toLocaleString()}</p>
                    </div>
                  `
                });
                infoWindow.open(mapInstanceRef.current, marker);
              });

              eventMarkersRef.current.push(marker);
            }
          });
        }
      } catch (error) {
        console.error('Error loading events:', error);
      }
    });

    return () => unsubscribe();
  }, [isMapLoaded]);

  // 🔁 REPLACED displayRoute with arrow-enhanced polyline
  const displayRoute = async (start, end, isFirstLeg = false) => {
    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: isFirstLeg ? window.google.maps.TravelMode.WALKING : window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') {
          const path = result.routes[0].overview_path;
          const distance = result.routes[0].legs[0].distance.text;
          const duration = result.routes[0].legs[0].duration.text;

          const lineSymbol = {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: isFirstLeg ? '#4CAF50' : '#2196F3',
          };

          const polyline = new google.maps.Polyline({
            path,
            icons: [{
              icon: lineSymbol,
              offset: '20%',
              repeat: '150px'
            }],
            strokeColor: isFirstLeg ? '#4CAF50' : '#2196F3',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: mapInstanceRef.current
          });

          polylinesRef.current.push(polyline);

          // Update route information through callback
          if (isFirstLeg) {
            onRouteInfoUpdate(prev => ({
              ...prev,
              walking: { distance, duration }
            }));
          } else {
            onRouteInfoUpdate(prev => ({
              ...prev,
              driving: { distance, duration },
              total: {
                distance: `${prev.walking.distance} + ${distance}`,
                duration: `${prev.walking.duration} + ${duration}`
              }
            }));
          }
        }
      }
    );
  };

  const createMarker = async (location, type) => {
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    let markerView;
    if (type === 'current') {
      markerView = new google.maps.marker.PinElement({
        background: "#FF9800",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2
      });
    } else if (type === 'nearest') {
      markerView = new google.maps.marker.PinElement({
        background: "#4CAF50",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2
      });
    } else {
      markerView = new google.maps.marker.PinElement({
        background: "#F44336",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2
      });
    }

    const marker = new AdvancedMarkerElement({
      map: mapInstanceRef.current,
      position: { lat: location.lat, lng: location.lng },
      title: location.nameEn,
      content: markerView.element
    });

    markersRef.current.push(marker);
  };

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    if (origin && destination) {
      cleanupMap();

      if (origin.currentLocation && origin.nearestStation) {
        createMarker(origin.currentLocation, 'current');
        createMarker(origin.nearestStation, 'nearest');
        createMarker(destination, 'destination');

        displayRoute(origin.currentLocation, origin.nearestStation, true);
        displayRoute(origin.nearestStation, destination);

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(origin.currentLocation);
        bounds.extend(origin.nearestStation);
        bounds.extend(destination);
        mapInstanceRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else {
        createMarker(origin.station, 'nearest');
        createMarker(destination, 'destination');
        displayRoute(origin.station, destination);
      }
    }
  }, [origin, destination, isMapLoaded]);

  return (
    <div className="map-section">
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%',
          height: '100%',
          minHeight: '600px',
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden'
        }} 
      />
    </div>
  );
};

export default MapComponent;
