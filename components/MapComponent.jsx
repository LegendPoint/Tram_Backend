import React, { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';

const MapComponent = ({ origin, destination, onRouteInfoUpdate }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const eventMarkersRef = useRef([]);
  const tramMarkersRef = useRef(new Map()); // Store tram markers
  const polylinesRef = useRef([]); // Store polylines for cleanup
  const [stations, setStations] = useState([]);
  const [events, setEvents] = useState([]);
  const [tramPositions, setTramPositions] = useState([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeColor, setRouteColor] = useState(null);

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
    // Clean up all polylines
    polylinesRef.current.forEach(polyline => {
      if (polyline && polyline.setMap) {
        polyline.setMap(null);
      }
    });
    polylinesRef.current = [];

    // Clean up all markers
    markersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];

    // Clean up all event markers
    eventMarkersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    eventMarkersRef.current = [];

    // Clean up all tram markers
    tramMarkersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    tramMarkersRef.current.clear();
  };

  const cleanupAll = () => {
    // Clean up everything including markers
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

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    const database = getDatabase();
    const tramRef = ref(database, 'tram_location');

    const unsubscribe = onValue(tramRef, async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const positions = snapshot.val();
          // Filter out the 'init' placeholder and convert to array
          const positionsArray = Object.entries(positions)
            .filter(([id]) => id !== 'init') // Filter out the 'init' placeholder
            .map(([id, data]) => ({
              id,
              lat: data.latitude,
              lng: data.longitude,
              color: data.color,
              lastUpdated: new Date().toISOString()
            }));
          setTramPositions(positionsArray);
          await updateTramMarkers(positionsArray);
        }
      } catch (error) {
        console.error('Error loading tram positions:', error);
      }
    });

    return () => unsubscribe();
  }, [isMapLoaded]);

  const updateTramMarkers = async (positions) => {
    if (!mapInstanceRef.current) return;

    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    // Remove old markers that are no longer in positions
    tramMarkersRef.current.forEach((marker, id) => {
      if (!positions.find(pos => pos.id === id)) {
        marker.setMap(null);
        tramMarkersRef.current.delete(id);
      }
    });

    // Update or create markers for current positions
    positions.forEach(position => {
      if (!position || !position.lat || !position.lng) {
        console.warn('Invalid tram position data:', position);
        return;
      }

      let marker = tramMarkersRef.current.get(position.id);
      
      if (!marker) {
        // Create new marker
        const markerView = new google.maps.marker.PinElement({
          background: getColorHex(position.color),
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          scale: 1.2
        });

        marker = new AdvancedMarkerElement({
          map: mapInstanceRef.current,
          position: { lat: position.lat, lng: position.lng },
          title: `Tram ${position.id}${position.color ? ` (${position.color})` : ''}`,
          content: markerView.element
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 10px;">
              ${position.color ? `<p style="font-size: 16px; font-weight: 800;"><strong>${position.color.charAt(0).toUpperCase() + position.color.slice(1)}</strong></p>` : ''}
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        tramMarkersRef.current.set(position.id, marker);
      } else {
        // Update existing marker position
        marker.position = { lat: position.lat, lng: position.lng };
      }
    });
  };

  const getColorHex = (color) => {
    if (!color) return '#808080'; // Default gray color for undefined colors

    const colorMap = {
      'red': '#FF0000',
      'green': '#00FF00',
      'blue': '#0000FF',
      'yellow': '#FFFF00'
    };
    return colorMap[color.toLowerCase()] || '#808080';
  };

  const displayRoute = async (startStation, endStation) => {
    try {
      if (!startStation || !endStation) {
        console.error('Start or end station is undefined');
        return;
      }

      // Check if origin and destination are the same
      if (startStation.id === endStation.id) {
        alert('Origin and destination cannot be the same. Please select different locations.');
        return;
      }

      // Use colors directly from the selected stations
      const startColors = startStation.colors || [];
      const endColors = endStation.colors || [];

      console.log('Start station colors:', startColors);
      console.log('End station colors:', endColors);

      // Find common colors between stations
      const commonColors = startColors.filter(color => endColors.includes(color));
      console.log('Common colors:', commonColors);

      if (commonColors.length === 0) {
        alert('No common route exists between these stations');
        return;
      }

      // Get available routes from the database
      const db = getDatabase();
      const routesRef = ref(db, 'Routes');
      const adminRoutesRef = ref(db, 'adminRoutes');
      const [routesSnapshot, adminRoutesSnapshot] = await Promise.all([
        get(routesRef),
        get(adminRoutesRef)
      ]);
      
      const availableRoutes = routesSnapshot.val() || {};
      const adminRoutes = adminRoutesSnapshot.val() || {};

      console.log('Available routes:', availableRoutes);
      console.log('Admin routes:', adminRoutes);

      // Only require a valid fixed route in adminRoutes
      const validColors = commonColors.filter(color => {
        const colorKey = color.toLowerCase();
        return adminRoutes[colorKey] && Array.isArray(adminRoutes[colorKey]) && adminRoutes[colorKey].length > 0;
      });

      console.log('Valid colors:', validColors);

      if (validColors.length === 0) {
        alert('No valid routes found between these stations');
        return;
      }

      // Calculate duration for each valid color
      const colorDurations = {};
      for (const color of validColors) {
        const route = availableRoutes[color];
        const startIndex = route.indexOf(startStation.id);
        const endIndex = route.indexOf(endStation.id);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const distance = Math.abs(endIndex - startIndex);
          colorDurations[color] = distance;
        }
      }

      console.log('Color durations:', colorDurations);

      if (Object.keys(colorDurations).length === 0) {
        alert('Could not find a valid path between these stations');
        return;
      }

      // Select the color with the shortest duration
      const selectedColor = Object.entries(colorDurations)
        .sort(([, a], [, b]) => a - b)[0][0];

      console.log('Selected route color:', selectedColor);
      setRouteColor(selectedColor);

      // Use lowercase keys for adminRoutes
      const colorKey = selectedColor.toLowerCase();
      const detailedRoute = adminRoutes[colorKey];
      if (!detailedRoute || !Array.isArray(detailedRoute) || detailedRoute.length === 0) {
        console.error('No detailed route points found for selected color');
        return;
      }

      // Find the closest point in the detailed route to each station
      function findClosestPointIndex(points, target) {
        let minDist = Infinity, idx = 0;
        points.forEach((p, i) => {
          const d = Math.hypot(p.lat - target.lat, p.lng - target.lng);
          if (d < minDist) { minDist = d; idx = i; }
        });
        return idx;
      }
      const startIdx = findClosestPointIndex(detailedRoute, startStation);
      const endIdx = findClosestPointIndex(detailedRoute, endStation);

      // Extract the segment, handling wrap-around for loops
      let routePortion;
      if (startIdx <= endIdx) {
        routePortion = detailedRoute.slice(startIdx, endIdx + 1);
      } else {
        // If the route is a loop and end is before start, wrap around
        routePortion = [
          ...detailedRoute.slice(startIdx),
          ...detailedRoute.slice(0, endIdx + 1)
        ];
      }

      // Add the destination point to the route if it's not already included (for non-Blue routes)
      const threshold = 0.05; // 30 meters in km
      let stopIdx = -1;
      for (let idx = 0; idx < routePortion.length; idx++) {
        const point = routePortion[idx];
        const dist = calculateDistance(point.lat, point.lng, endStation.lat, endStation.lng);
        if (dist <= threshold) {
          stopIdx = idx;
          break; // Stop at the first point within 30 meters
        }
      }
      if (stopIdx !== -1) {
        // Keep up to the close point, then connect directly to the destination if close enough
        routePortion = routePortion.slice(0, stopIdx + 1);
        const last = routePortion[routePortion.length - 1];
        const distToDest = calculateDistance(last.lat, last.lng, endStation.lat, endStation.lng);
        if (distToDest <= threshold && (last.lat !== endStation.lat || last.lng !== endStation.lng)) {
          routePortion.push({ lat: endStation.lat, lng: endStation.lng });
        }
        // If too far, do not connect to the marker
      } else {
        // If no point is within the threshold, keep the original logic for appending destination if close enough
        const lastPoint = routePortion[routePortion.length - 1];
        const destinationPoint = { lat: endStation.lat, lng: endStation.lng };
        const distToDest = calculateDistance(lastPoint.lat, lastPoint.lng, endStation.lat, endStation.lng);
        if (distToDest <= threshold && (lastPoint.lat !== destinationPoint.lat || lastPoint.lng !== destinationPoint.lng)) {
          routePortion.push(destinationPoint);
        }
        // If too far, do not connect to the marker
      }

      // Create polyline with the selected portion of the route
      const routeColors = {
        'Red': '#F44336',
        'Blue': '#2196F3',
        'Green': '#4CAF50',
        'Yellow': '#FFEB3B'
      };

      const polyline = new google.maps.Polyline({
        path: routePortion,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: routeColors[selectedColor] || '#2196F3'
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: routeColors[selectedColor] || '#2196F3',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });

      polylinesRef.current.push(polyline);

      // Calculate distance and duration based on the route portion
      const distance = calculateRouteDistance(routePortion);
      const duration = calculateRouteDuration(distance);
      
      onRouteInfoUpdate(prev => ({
        ...prev,
        driving: { distance, duration },
        total: {
          distance: `${prev.walking.distance} + ${distance}`,
          duration: `${prev.walking.duration} + ${duration}`
        }
      }));

      // Check if the selected destination is near the route
      const isDestinationNearRoute = isPointNearRoute(routePortion, endStation);
      if (!isDestinationNearRoute) {
        alert('Warning: The selected destination is not near the tram route. Please select a destination closer to the route.');
      }

      const markerThreshold = 0.01; // 10 meters in km
      // Connect origin marker to polyline if close enough
      const firstRoutePoint = routePortion[0];
      const originDist = calculateDistance(startStation.lat, startStation.lng, firstRoutePoint.lat, firstRoutePoint.lng);
      if (originDist <= markerThreshold && (startStation.lat !== firstRoutePoint.lat || startStation.lng !== firstRoutePoint.lng)) {
        routePortion.unshift({ lat: startStation.lat, lng: startStation.lng });
      }
      // Connect destination marker to polyline if close enough
      const lastRoutePoint = routePortion[routePortion.length - 1];
      const destDist = calculateDistance(endStation.lat, endStation.lng, lastRoutePoint.lat, lastRoutePoint.lng);
      if (destDist <= markerThreshold && (endStation.lat !== lastRoutePoint.lat || endStation.lng !== lastRoutePoint.lng)) {
        routePortion.push({ lat: endStation.lat, lng: endStation.lng });
      }
    } catch (error) {
      console.error('Error fetching route information:', error);
      alert('Error loading route information. Please try again.');
    }
  };

  const findClosestPointIndex = (path, location) => {
    let minDistance = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < path.length; i++) {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        path[i].lat,
        path[i].lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  };

  const findClosestPointOnRoute = (path, location) => {
    let minDistance = Infinity;
    let closestPoint = null;
    
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      
      // Calculate the closest point on the line segment
      const closest = findClosestPointOnLineSegment(
        location.lat, location.lng,
        start.lat, start.lng,
        end.lat, end.lng
      );
      
      const distance = calculateDistance(
        location.lat, location.lng,
        closest.lat, closest.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = closest;
      }
    }
    
    return closestPoint;
  };

  const findClosestPointOnLineSegment = (x, y, x1, y1, x2, y2) => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) {
      param = dot / len_sq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    return { lat: xx, lng: yy };
  };

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Helper function to convert degrees to radians
  const toRad = (value) => {
    return value * Math.PI / 180;
  };

  // Helper function to calculate total route distance
  const calculateRouteDistance = (path) => {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += calculateDistance(
        path[i].lat,
        path[i].lng,
        path[i + 1].lat,
        path[i + 1].lng
      );
    }
    return `${totalDistance.toFixed(1)} km`;
  };

  // Helper function to estimate route duration
  const calculateRouteDuration = (distance) => {
    const distanceInKm = parseFloat(distance);
    const averageSpeed = 20; // km/h
    const durationInHours = distanceInKm / averageSpeed;
    const hours = Math.floor(durationInHours);
    const minutes = Math.round((durationInHours - hours) * 60);
    
    if (hours === 0) {
      return `${minutes} min`;
    } else if (minutes === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${minutes} min`;
    }
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
    } else if (type === 'destination') {
      markerView = new google.maps.marker.PinElement({
        background: "#F44336", // Red color for destination
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
        scale: 1.2
      });
    } else {
      markerView = new google.maps.marker.PinElement({
        background: "#2196F3", // Blue color for other markers
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

  const cleanupPolylines = () => {
    // Clean up all polylines and route dots
    polylinesRef.current.forEach(polyline => {
      if (polyline && polyline.setMap) {
        polyline.setMap(null);
      }
    });
    polylinesRef.current = [];
  };

  const cleanupMarkers = () => {
    // Clean up all markers
    markersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];

    // Clean up all event markers
    eventMarkersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    eventMarkersRef.current = [];
  };

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    if (origin && destination) {
      cleanupPolylines(); // Only clean up polylines and route dots
      cleanupMarkers();   // Clean up all markers, including destination markers

      const bounds = new window.google.maps.LatLngBounds();
      let points = [];

      if (origin.currentLocation && origin.nearestStation) {
        createMarker(origin.currentLocation, 'current');
        createMarker(origin.nearestStation, 'nearest');
        createMarker(destination, 'destination');

        displayRoute(origin.currentLocation, origin.nearestStation, true);
        displayRoute(origin.nearestStation, destination);

        points = [origin.currentLocation, origin.nearestStation, destination];
        bounds.extend(origin.currentLocation);
        bounds.extend(origin.nearestStation);
        bounds.extend(destination);
      } else {
        createMarker(origin.station, 'nearest');
        createMarker(destination, 'destination');
        displayRoute(origin.station, destination);

        points = [origin.station, destination];
        bounds.extend(origin.station);
        bounds.extend(destination);
      }

      // Check if all points are almost the same (distance < 10 meters)
      const arePointsClose = (pts) => {
        if (pts.length < 2) return true;
        const toRad = (v) => v * Math.PI / 180;
        const dist = (a, b) => {
          const R = 6371000; // meters
          const dLat = toRad(b.lat - a.lat);
          const dLng = toRad(b.lng - a.lng);
          const lat1 = toRad(a.lat);
          const lat2 = toRad(b.lat);
          const aVal = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLng/2) * Math.sin(dLng/2) * Math.cos(lat1) * Math.cos(lat2);
          const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1-aVal));
          return R * c;
        };
        for (let i = 0; i < pts.length - 1; i++) {
          if (dist(pts[i], pts[i+1]) > 10) return false;
        }
        return true;
      };

      const padding = { top: 175, right: 175, bottom: 200, left: 175 };
      if (arePointsClose(points)) {
        // If points are very close or identical, center and set min zoom
        const center = points[0];
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setZoom(16);
      } else {
        mapInstanceRef.current.fitBounds(bounds, padding);
      }
    }
  }, [origin, destination, isMapLoaded]);

  // Helper function to check if a point is near the route
  const isPointNearRoute = (route, point, threshold = 0.5) => { // threshold in kilometers (500 meters)
    for (let i = 0; i < route.length; i++) {
      const distance = calculateDistance(
        point.lat,
        point.lng,
        route[i].lat,
        route[i].lng
      );
      if (distance <= threshold) {
        return true;
      }
    }
    return false;
  };

  // Helper function to convert duration string to minutes
  const parseDurationToMinutes = (duration) => {
    const parts = duration.split(' ');
    let totalMinutes = 0;
    
    for (let i = 0; i < parts.length; i += 2) {
      const value = parseInt(parts[i]);
      const unit = parts[i + 1];
      
      if (unit.startsWith('hr')) {
        totalMinutes += value * 60;
      } else if (unit.startsWith('min')) {
        totalMinutes += value;
      }
    }
    
    return totalMinutes;
  };

  return (
    <div className="map-section">
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%',
          height: '100%',
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          flex: '1 1 auto'
        }} 
      />
    </div>
  );
};

export default MapComponent;
