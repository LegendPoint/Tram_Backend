import React, { useEffect, useRef, useState } from 'react';
import stationService from '../services/stationService';
import eventService from '../services/eventService';
import tramService from '../services/tramService';
import routeService from '../services/routeService';

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

  // Define Mahidol University boundaries
  const mahidolBoundaries = {
    north: 13.805, // Northern boundary
    south: 13.785, // Southern boundary
    east: 100.325,  // Eastern boundary
    west: 100.310   // Western boundary
  };

  // Helper function to check if a point is within Mahidol boundaries
  const isWithinMahidolBoundaries = (lat, lng) => {
    return lat >= mahidolBoundaries.south && 
           lat <= mahidolBoundaries.north && 
           lng >= mahidolBoundaries.west && 
           lng <= mahidolBoundaries.east;
  };

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

    const unsubscribe = stationService.getAllStations(async (stationsData) => {
      try {
        const loadingElements = mapInstanceRef.current.controls[window.google.maps.ControlPosition.TOP_CENTER].getArray();
        loadingElements.forEach(element => {
          if (element.className === 'map-loading') {
            mapInstanceRef.current.controls[window.google.maps.ControlPosition.TOP_CENTER].removeAt(0);
          }
        });

        setStations(stationsData);

        if (!origin && !destination && stationsData.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          stationsData.forEach(station => {
            bounds.extend({ lat: station.lat, lng: station.lng });
          });
          mapInstanceRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        }
      } catch (error) {
        console.error('Error loading stations:', error);
      }
    });

    return () => unsubscribe();
  }, [isMapLoaded, origin, destination]);

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    const unsubscribe = eventService.getAllEvents(async (eventsData) => {
      try {
        setEvents(eventsData);

        eventMarkersRef.current.forEach(marker => marker.setMap(null));
        eventMarkersRef.current = [];

        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        eventsData.forEach(event => {
          if (event.location) {
            // Check if the event has passed its end date
            const eventEndDate = new Date(event.endDate);
            const currentDate = new Date();
            
            // Only create marker if the event hasn't ended
            if (currentDate <= eventEndDate) {
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

              marker.addListener('gmp-click', () => {
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
          }
        });
      } catch (error) {
        console.error('Error loading events:', error);
      }
    });

    return () => unsubscribe();
  }, [isMapLoaded]);

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    const unsubscribe = tramService.getAllTramPositions(async (positionsArray) => {
      try {
        console.log('Received tram positions:', positionsArray);
        setTramPositions(positionsArray);
        await updateTramMarkers(positionsArray);
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

  const findNearestTram = async (location, stationColors) => {
    try {
      let nearestTram = null;
      let minDistance = Infinity;
      
      console.log('Finding nearest tram for station colors:', stationColors);
      console.log('Current tram positions:', tramPositions);
      
      // Filter trams that have common colors with the station and are within Mahidol boundaries
      const validTrams = tramPositions.filter(tram => {
        if (!tram || !tram.color || !tram.lat || !tram.lng) {
          console.log('Invalid tram data:', tram);
          return false;
        }
        
        // Check if tram is within Mahidol boundaries
        // if (!isWithinMahidolBoundaries(tram.lat, tram.lng)) {
        //   console.log('Tram outside Mahidol boundaries:', tram);
        //   return false;
        // }
        
        // Convert tram's single color to lowercase for comparison
        const tramColor = tram.color.toLowerCase();
        // Check if the tram's color is in the station's colors array
        const hasMatchingColor = stationColors.some(color => color.toLowerCase() === tramColor);
        console.log('Tram color:', tramColor, 'matches station colors:', hasMatchingColor);
        return hasMatchingColor;
      });

      console.log('Valid trams with matching colors:', validTrams);

      if (validTrams.length === 0) {
        console.log('No trams found with matching colors within Mahidol boundaries:', stationColors);
        return null;
      }

      const locationPoint = new google.maps.LatLng(location.lat, location.lng);
      
      for (const tram of validTrams) {
        const tramPoint = new google.maps.LatLng(tram.lat, tram.lng);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(locationPoint, tramPoint);
        console.log('Tram distance:', distance/1000, 'km');
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestTram = tram;
        }
      }

      console.log('Found nearest tram:', nearestTram, 'at distance:', minDistance/1000, 'kilometers');
      return nearestTram;
    } catch (error) {
      console.error('Error finding nearest tram:', error);
      return null;
    }
  };

  const displayRoute = async (startStation, endStation) => {
    try {
      if (!startStation || !endStation) {
        console.error('Start or end station is undefined');
        return;
      }

      console.log('Displaying route for stations:', { startStation, endStation });

      // Check if origin and destination are the same
      if (startStation.id === endStation.id) {
        alert('Origin and destination cannot be the same. Please select different locations.');
        return;
      }

      // Use colors directly from the selected stations
      const startColors = startStation.colors || [];
      const endColors = endStation.colors || [];

      console.log('Station colors:', { startColors, endColors });

      // Find common colors between stations
      const commonColors = startColors.filter(color => endColors.includes(color));
      console.log('Common colors between stations:', commonColors);

      if (commonColors.length === 0) {
        alert('No common route exists between these stations');
        return;
      }

      // Get available routes from the database
      const { routes, adminRoutes } = await routeService.getAllRoutes();
      console.log('Available routes:', { routes, adminRoutes });

      // Only require a valid fixed route in adminRoutes
      const validColors = commonColors.filter(color => {
        const colorKey = color.toLowerCase();
        return adminRoutes[colorKey] && Array.isArray(adminRoutes[colorKey]) && adminRoutes[colorKey].length > 0;
      });

      console.log('Valid colors with routes:', validColors);

      if (validColors.length === 0) {
        alert('No valid routes found between these stations');
        return;
      }

      // Find nearest tram to the origin station
      const nearestTram = await findNearestTram(startStation, startColors);
      
      if (!nearestTram) {
        alert('No suitable tram found with matching colors within Mahidol University. Please check if any trams are available.');
        return;
      }

      // Select the color with the shortest duration
      const selectedColor = validColors[0];
      setRouteColor(selectedColor);

      // Use lowercase keys for adminRoutes
      const colorKey = selectedColor.toLowerCase();
      const detailedRoute = adminRoutes[colorKey];
      if (!detailedRoute || !Array.isArray(detailedRoute) || detailedRoute.length === 0) {
        console.error('No detailed route points found for selected color');
        return;
      }

      // Find the closest point in the detailed route to the stations
      const startIdx = await findClosestPointIndex(detailedRoute, startStation);
      const endIdx = await findClosestPointIndex(detailedRoute, endStation);

      // Get route from start to end station following the fixed route
      let startToEndRoute;
      if (startIdx <= endIdx) {
        startToEndRoute = detailedRoute.slice(startIdx, endIdx + 1);
      } else {
        startToEndRoute = [
          ...detailedRoute.slice(startIdx),
          ...detailedRoute.slice(0, endIdx + 1)
        ];
      }

      // Create polylines for both routes
      const tramToStartPolyline = new google.maps.Polyline({
        path: [
          { lat: nearestTram.lat, lng: nearestTram.lng },
          { lat: startStation.lat, lng: startStation.lng }
        ],
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: getColorHex(selectedColor)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(selectedColor),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });

      // Create polyline for the fixed route
      const startToEndPolyline = new google.maps.Polyline({
        path: startToEndRoute,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: getColorHex(selectedColor)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(selectedColor),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });

      polylinesRef.current.push(tramToStartPolyline, startToEndPolyline);

      // Calculate distances and durations using the Google Maps Routes API
      try {
        const { DirectionsService } = await window.google.maps.importLibrary('routes');
        const directionsService = new DirectionsService();

        // 1. Tram to Start Station
        const tramToStartRequest = {
          origin: { lat: nearestTram.lat, lng: nearestTram.lng },
          destination: { lat: startStation.lat, lng: startStation.lng },
          travelMode: window.google.maps.TravelMode.DRIVING
        };

        // 2. Start to End Station (using fixed route points as waypoints)
        const MAX_WAYPOINTS = 20; // Keep well below the API limit
        let waypoints = startToEndRoute.slice(1, -1)
          .filter(point =>
            typeof point.lat === 'number' &&
            typeof point.lng === 'number' &&
            !isNaN(point.lat) &&
            !isNaN(point.lng) &&
            isWithinMahidolBoundaries(point.lat, point.lng) // Only include waypoints within Mahidol
          );
        
        // If too many waypoints, sample them evenly
        if (waypoints.length > MAX_WAYPOINTS) {
          const step = Math.ceil(waypoints.length / MAX_WAYPOINTS);
          waypoints = waypoints.filter((_, idx) => idx % step === 0);
        }
        
        waypoints = waypoints.map(point => ({
          location: { lat: point.lat, lng: point.lng },
          stopover: false
        }));

        const startToEndRequest = {
          origin: { lat: startStation.lat, lng: startStation.lng },
          destination: { lat: endStation.lat, lng: endStation.lng },
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING
        };

        // Debug logging for API requests
        console.log('Directions API request:', {
          tramToStartRequest,
          startToEndRequest: { ...startToEndRequest, waypoints }
        });

        // Run both requests in parallel
        const [tramToStartResult, startToEndResult] = await Promise.all([
          new Promise((resolve, reject) => {
            directionsService.route(tramToStartRequest, (result, status) => {
              if (status === 'OK') resolve(result);
              else {
                console.error('TramToStart Directions request failed:', status, result);
                reject(status);
              }
            });
          }),
          new Promise((resolve, reject) => {
            directionsService.route(startToEndRequest, (result, status) => {
              if (status === 'OK') resolve(result);
              else {
                console.error('StartToEnd Directions request failed:', status, result);
                reject(status);
              }
            });
          })
        ]);

        const tramLeg = tramToStartResult.routes[0].legs[0];
        const startToEndLeg = startToEndResult.routes[0].legs[0];

        // Update route information with actual distance and duration from Routes API
        onRouteInfoUpdate(prev => ({
          ...prev,
          tramToStart: {
            distance: tramLeg.distance.text,
            duration: tramLeg.duration.text
          },
          startToEnd: {
            distance: startToEndLeg.distance.text,
            duration: startToEndLeg.duration.text
          },
          total: {
            distance: `${parseFloat(tramLeg.distance.value / 1000 + startToEndLeg.distance.value / 1000).toFixed(1)} km`,
            duration: `${Math.round((tramLeg.duration.value + startToEndLeg.duration.value) / 60)} min`
          }
        }));
      } catch (error) {
        console.error('Error calculating distances with Routes API:', error);
      }

      // Check if the selected destination is near the route
      const isDestinationNearRoute = await isPointNearRoute(startToEndRoute, endStation);
      if (!isDestinationNearRoute) {
        alert('Warning: The selected destination is not near the tram route. Please select a destination closer to the route.');
      }

    } catch (error) {
      console.error('Error fetching route information:', error);
      alert('Error loading route information. Please try again.');
    }
  };

  const arePointsClose = async (pts) => {
    if (pts.length < 2) return true;
    
    try {
      const geometry = await google.maps.importLibrary("geometry");
      const locationPoint = new google.maps.LatLng(pts[0].lat, pts[0].lng);
      
      for (let i = 1; i < pts.length; i++) {
        const point2 = new google.maps.LatLng(pts[i].lat, pts[i].lng);
        const distance = geometry.spherical.computeDistanceBetween(locationPoint, point2);
        
        if (distance > 10) return false; // 10 meters threshold
      }
      return true;
    } catch (error) {
      console.error('Error loading geometry library:', error);
      return true; // Fallback to true if geometry library fails to load
    }
  };

  const findClosestPointIndex = async (path, location) => {
    let minDistance = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < path.length; i++) {
      const pathPoint = new google.maps.LatLng(path[i].lat, path[i].lng);
      const distance = google.maps.geometry.spherical.computeDistanceBetween(pathPoint, location);
      
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
      
      const distance = google.maps.geometry.spherical.computeDistanceBetween(location, closest);
      
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

  // Helper function to calculate total route distance
  const calculateRouteDistance = (path) => {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += google.maps.geometry.spherical.computeDistanceBetween(path[i], path[i + 1]);
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

    const handleRouteUpdate = async () => {
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
        const arePointsClose2 = async (pts) => {
        if (pts.length < 2) return true;
          
          try {
            const geometry = await google.maps.importLibrary("geometry");
            const locationPoint = new google.maps.LatLng(pts[0].lat, pts[0].lng);
            
            for (let i = 1; i < pts.length; i++) {
              const point2 = new google.maps.LatLng(pts[i].lat, pts[i].lng);
              const distance = geometry.spherical.computeDistanceBetween(locationPoint, point2);
              
              if (distance > 10) return false; // 10 meters threshold
        }
        return true;
          } catch (error) {
            console.error('Error loading geometry library:', error);
            return true; // Fallback to true if geometry library fails to load
          }
      };

      const padding = { top: 175, right: 175, bottom: 200, left: 175 };
        if (await arePointsClose2(points)) {
        // If points are very close or identical, center and set min zoom
        const center = points[0];
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setZoom(16);
      } else {
        mapInstanceRef.current.fitBounds(bounds, padding);
      }
    }
    };

    handleRouteUpdate();
  }, [origin, destination, isMapLoaded]);

  const isPointNearRoute = async (route, point, threshold = 0.5) => { // threshold in kilometers (500 meters)
    try {
      const geometry = await google.maps.importLibrary("geometry");
      const pointLatLng = new google.maps.LatLng(point.lat, point.lng);
      
    for (let i = 0; i < route.length; i++) {
        const routePoint = new google.maps.LatLng(route[i].lat, route[i].lng);
        const distance = geometry.spherical.computeDistanceBetween(pointLatLng, routePoint) / 1000; // Convert meters to kilometers
        
      if (distance <= threshold) {
        return true;
      }
    }
    return false;
    } catch (error) {
      console.error('Error loading geometry library:', error);
      return true; // Fallback to true if geometry library fails to load
    }
  };

  // Helper function to format duration from minutes
  const formatDurationFromMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    
    if (hours === 0) {
      return `${remainingMinutes} min`;
    } else if (remainingMinutes === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${remainingMinutes} min`;
    }
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
