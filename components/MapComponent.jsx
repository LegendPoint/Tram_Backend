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

  // Find the best transfer station between two stations
  const findBestTransferStation = async (startStation, endStation) => {
    try {
      const startColors = startStation.colors || [];
      const endColors = endStation.colors || [];
      
      // Get all stations
      const allStations = await new Promise((resolve) => {
        const unsubscribe = stationService.getAllStations((stations) => {
          unsubscribe();
          resolve(stations);
        });
      });

      let bestTransferStation = null;
      let minTotalDistance = Infinity;

      // Find stations that have common colors with the destination
      const potentialTransferStations = allStations.filter(station => {
        const stationColors = station.colors || [];
        return stationColors.some(color => endColors.includes(color));
      });

      // For each potential transfer station, calculate the total distance
      for (const transferStation of potentialTransferStations) {
        // Skip if it's the start or end station
        if (transferStation.id === startStation.id || transferStation.id === endStation.id) {
          continue;
        }

        // Calculate distance from start to transfer station
        const startToTransfer = google.maps.geometry.spherical.computeDistanceBetween(
          { lat: startStation.lat, lng: startStation.lng },
          { lat: transferStation.lat, lng: transferStation.lng }
        );

        // Calculate distance from transfer to end station
        const transferToEnd = google.maps.geometry.spherical.computeDistanceBetween(
          { lat: transferStation.lat, lng: transferStation.lng },
          { lat: endStation.lat, lng: endStation.lng }
        );

        const totalDistance = startToTransfer + transferToEnd;

        if (totalDistance < minTotalDistance) {
          minTotalDistance = totalDistance;
          bestTransferStation = transferStation;
        }
      }

      return bestTransferStation;
    } catch (error) {
      console.error('Error finding transfer station:', error);
      return null;
    }
  };

  // Helper function to calculate total route distance
  const calculateRouteDistance = (path) => {
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += google.maps.geometry.spherical.computeDistanceBetween(path[i], path[i + 1]);
    }
    return (totalDistance / 1000).toFixed(1) + " km";
  };

  // Helper function to calculate route duration using Google Maps API
  const calculateRouteDuration = async (origin, destination) => {
    try {
      const { DirectionsService } = await google.maps.importLibrary("routes");
      const directionsService = new DirectionsService();

      return new Promise((resolve, reject) => {
        directionsService.route(
          {
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK") {
              const duration = result.routes[0].legs[0].duration.text;
              resolve(duration);
            } else {
              console.error("Error calculating route duration:", status);
              // Fallback to manual calculation if API fails
              const distance = google.maps.geometry.spherical.computeDistanceBetween(
                { lat: origin.lat, lng: origin.lng },
                { lat: destination.lat, lng: destination.lng }
              ) / 1000; // Convert to kilometers
              const averageSpeed = 20; // km/h
              const durationInHours = distance / averageSpeed;
              const hours = Math.floor(durationInHours);
              const minutes = Math.round((durationInHours - hours) * 60);
              resolve(hours === 0 ? minutes + " min" : hours + " hr " + minutes + " min");
            }
          }
        );
      });
    } catch (error) {
      console.error("Error in calculateRouteDuration:", error);
      return "Unknown duration";
    }
  };

  // Helper function to find route between stations from database
  const findRouteBetweenStations = async (startStation, endStation) => {
    try {
      const routes = await new Promise((resolve) => {
        const unsubscribe = routeService.getAllRoutes((routes) => {
          unsubscribe();
          resolve(routes);
        });
      });

      // Find routes that contain both stations
      const matchingRoutes = routes.filter(route => {
        const stationIds = route.stations.map(station => station.id);
        return stationIds.includes(startStation.id) && stationIds.includes(endStation.id);
      });

      if (matchingRoutes.length === 0) {
        console.log("No matching routes found between stations");
        return null;
      }

      // Find the route with the shortest path between stations
      let bestRoute = null;
      let minStationCount = Infinity;

      for (const route of matchingRoutes) {
        const startIndex = route.stations.findIndex(station => station.id === startStation.id);
        const endIndex = route.stations.findIndex(station => station.id === endStation.id);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const stationCount = Math.abs(endIndex - startIndex);
          if (stationCount < minStationCount) {
            minStationCount = stationCount;
            bestRoute = route;
          }
        }
      }

      if (!bestRoute) {
        console.log("No suitable route found");
        return null;
      }

      // Get the stations between start and end
      const startIndex = bestRoute.stations.findIndex(station => station.id === startStation.id);
      const endIndex = bestRoute.stations.findIndex(station => station.id === endStation.id);
      
      const stations = startIndex < endIndex 
        ? bestRoute.stations.slice(startIndex, endIndex + 1)
        : bestRoute.stations.slice(endIndex, startIndex + 1).reverse();

      return {
        route: bestRoute,
        stations: stations
      };
    } catch (error) {
      console.error("Error finding route between stations:", error);
      return null;
    }
  };

  // Helper to parse duration string (e.g., '1 hr 5 min', '28 min') to minutes
  const parseDurationToMinutes = (durationStr) => {
    let total = 0;
    const hrMatch = durationStr.match(/(\d+)\s*hr/);
    const minMatch = durationStr.match(/(\d+)\s*min/);
    if (hrMatch) total += parseInt(hrMatch[1], 10) * 60;
    if (minMatch) total += parseInt(minMatch[1], 10);
    return total;
  };

  // Helper: find closest index on a path to a given point
  const findClosestIndexOnPath = (path, point) => {
    let minDist = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < path.length; i++) {
      const dist = Math.sqrt(Math.pow(path[i].lat - point.lat, 2) + Math.pow(path[i].lng - point.lng, 2));
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  // Store the current main route segment for real-time updates
  const mainRouteSegmentRef = useRef(null);
  const mainRouteColorRef = useRef(null);
  const secondRouteSegmentRef = useRef(null);
  const secondRouteColorRef = useRef(null);
  const [currentTramPos, setCurrentTramPos] = useState(null);
  const [secondTramPos, setSecondTramPos] = useState(null);

  // Real-time update of polylines as tram moves
  useEffect(() => {
    if (!mainRouteSegmentRef.current || !mainRouteColorRef.current || !currentTramPos || !mapInstanceRef.current) return;
    // Remove previous main route polylines
    if (polylinesRef.current._mainRoutePassed) {
      polylinesRef.current._mainRoutePassed.setMap(null);
    }
    if (polylinesRef.current._mainRouteRemaining) {
      polylinesRef.current._mainRouteRemaining.setMap(null);
    }
    const routeSegment = mainRouteSegmentRef.current;
    const color = mainRouteColorRef.current;
    const tramIdx = findClosestIndexOnPath(routeSegment, currentTramPos);
    // Calculate distance from tram to closest point on route
    const tramPoint = currentTramPos;
    const closestRoutePoint = routeSegment[tramIdx];
    const dist = Math.sqrt(Math.pow(tramPoint.lat - closestRoutePoint.lat, 2) + Math.pow(tramPoint.lng - closestRoutePoint.lng, 2));
    const THRESHOLD = 0.0003; // ~30 meters
    if (dist > THRESHOLD) {
      // Tram is not on/near the route: show full route in color, no gray segment
      polylinesRef.current._mainRouteRemaining = new google.maps.Polyline({
        path: routeSegment,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: getColorHex(color)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(color),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      return;
    }
    // Passed segment: from start to tramIdx
    if (tramIdx > 0) {
      polylinesRef.current._mainRoutePassed = new google.maps.Polyline({
        path: routeSegment.slice(0, tramIdx + 1),
        strokeColor: '#888888',
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
    }
    // Remaining segment: from tramIdx to end
    polylinesRef.current._mainRouteRemaining = new google.maps.Polyline({
      path: routeSegment.slice(tramIdx),
      icons: [{
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 4,
          strokeColor: getColorHex(color)
        },
        offset: '20%',
        repeat: '150px'
      }],
      strokeColor: getColorHex(color),
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: mapInstanceRef.current
    });
  }, [currentTramPos]);

  // Real-time update for second tram (transfer route)
  useEffect(() => {
    if (!secondRouteSegmentRef.current || !secondRouteColorRef.current || !secondTramPos || !mapInstanceRef.current) return;
    // Remove previous second route polylines
    if (polylinesRef.current._secondRoutePassed) {
      polylinesRef.current._secondRoutePassed.setMap(null);
    }
    if (polylinesRef.current._secondRouteRemaining) {
      polylinesRef.current._secondRouteRemaining.setMap(null);
    }
    const routeSegment = secondRouteSegmentRef.current;
    const color = secondRouteColorRef.current;
    const tramIdx = findClosestIndexOnPath(routeSegment, secondTramPos);
    // Calculate distance from tram to closest point on route
    const tramPoint = secondTramPos;
    const closestRoutePoint = routeSegment[tramIdx];
    const dist = Math.sqrt(Math.pow(tramPoint.lat - closestRoutePoint.lat, 2) + Math.pow(tramPoint.lng - closestRoutePoint.lng, 2));
    const THRESHOLD = 0.0003; // ~30 meters
    if (dist > THRESHOLD) {
      // Tram is not on/near the route: show full route in color, no gray segment
      polylinesRef.current._secondRouteRemaining = new google.maps.Polyline({
        path: routeSegment,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: getColorHex(color)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(color),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      return;
    }
    // Passed segment: from start to tramIdx
    if (tramIdx > 0) {
      polylinesRef.current._secondRoutePassed = new google.maps.Polyline({
        path: routeSegment.slice(0, tramIdx + 1),
        strokeColor: '#888888',
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
    }
    // Remaining segment: from tramIdx to end
    polylinesRef.current._secondRouteRemaining = new google.maps.Polyline({
      path: routeSegment.slice(tramIdx),
      icons: [{
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 4,
          strokeColor: getColorHex(color)
        },
        offset: '20%',
        repeat: '150px'
      }],
      strokeColor: getColorHex(color),
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: mapInstanceRef.current
    });
  }, [secondTramPos]);

  // Update tram positions for real-time polyline update
  useEffect(() => {
    if (!tramPositions || tramPositions.length === 0) return;
    
    // Find trams for both legs of the route
    const firstTram = tramPositions.find(tram => tram.color === mainRouteColorRef.current);
    const secondTram = tramPositions.find(tram => tram.color === secondRouteColorRef.current);
    
    if (firstTram && firstTram.lat && firstTram.lng) {
      setCurrentTramPos({ lat: firstTram.lat, lng: firstTram.lng });
    }
    
    if (secondTram && secondTram.lat && secondTram.lng) {
      setSecondTramPos({ lat: secondTram.lat, lng: secondTram.lng });
    }
  }, [tramPositions]);

  // Modified displayRoute function to handle transfer routes
  const displayRoute = async (startStation, endStation) => {
    try {
      if (!startStation || !endStation) {
        console.error('Start or end station is undefined');
        return;
      }

      console.log('Displaying route for stations:', { startStation, endStation });

      if (startStation.id === endStation.id) {
        alert('Origin and destination cannot be the same. Please select different locations.');
        return;
      }

      const startColors = startStation.colors || [];
      const endColors = endStation.colors || [];
      const commonColors = startColors.filter(color => endColors.includes(color));

      const { adminRoutes } = await routeService.getAllRoutes();
      console.log('Available adminRoutes:', adminRoutes);

      // Helper to get fixed route segment between two stations
      const getRouteSegment = async (color, fromStation, toStation) => {
        const colorKey = color.toLowerCase();
        // Convert all adminRoutes keys to lowercase for case-insensitive comparison
        const adminRoutesLower = Object.fromEntries(
          Object.entries(adminRoutes).map(([key, value]) => [key.toLowerCase(), value])
        );
        const fixedRoute = adminRoutesLower[colorKey];
        if (!fixedRoute || !Array.isArray(fixedRoute) || fixedRoute.length === 0) return null;
        // --- Find the closest indexes on the fixed route to the markers ---
        const fromIdx = await findClosestPointIndex(fixedRoute, fromStation);
        const toIdx = await findClosestPointIndex(fixedRoute, toStation);
        let path;
        // --- Use the indexes to slice the fixed route, so the polyline follows the adminRoute ---
        if (fromIdx <= toIdx) {
          // Forward direction
          path = fixedRoute.slice(fromIdx, toIdx + 1); // <-- This line makes the polyline follow the fixed route from fromIdx to toIdx
        } else {
          // Wrap around (for circular routes)
          path = [
            ...fixedRoute.slice(fromIdx), // <-- This and the next line together make the polyline follow the fixed route in a circular fashion
            ...fixedRoute.slice(0, toIdx + 1)
          ];
        }
        // Do NOT add marker coordinates, just use the fixed route segment
        return path;
      };

      // Direct route (common color)
      if (commonColors.length > 0) {
        const selectedColor = commonColors[0];
        setRouteColor(selectedColor);
        let routeSegment = await getRouteSegment(selectedColor, startStation, endStation);
        console.log('Direct routeSegment:', routeSegment);
        if (!routeSegment || routeSegment.length < 2) {
          alert('No valid fixed route found for this color.');
          return;
        }
        // Draw main route polyline
        const mainRoutePolyline = new google.maps.Polyline({
          path: routeSegment,
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
        polylinesRef.current.push(mainRoutePolyline);
        // Find nearest tram
        const nearestTram = await findNearestTram(startStation, startColors);
        if (!nearestTram) {
          alert('No suitable tram found with matching colors. Please check if any trams are available.');
          return;
        }
        // Draw tram-to-origin polyline
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
        polylinesRef.current.push(tramToStartPolyline);
        // Set up for real-time update
        mainRouteSegmentRef.current = routeSegment;
        mainRouteColorRef.current = selectedColor;
        setCurrentTramPos({ lat: nearestTram.lat, lng: nearestTram.lng });
        // Calculate durations for each segment
        const tramToStartDuration = await calculateRouteDuration(nearestTram, startStation);
        const startToEndDuration = await calculateRouteDuration(startStation, endStation);
        const totalMins = parseDurationToMinutes(tramToStartDuration) + parseDurationToMinutes(startToEndDuration);
        onRouteInfoUpdate({
          tramToStart: {
            color: selectedColor,
            distance: calculateRouteDistance([nearestTram, startStation]),
            duration: tramToStartDuration
          },
          startToEnd: {
            color: selectedColor,
            distance: calculateRouteDistance(routeSegment),
            duration: startToEndDuration
          },
          total: {
            label: 'Origin to Destination',
            distance: calculateRouteDistance(routeSegment),
            duration: totalMins + ' mins'
          }
        });
        return;
      }

      // --- TRANSFER LOGIC ---
      // No common color: find transfer station
      // 1. Find nearest tram (use first color of startStation)
      let tramToStartDistance = '', tramToStartDuration = '';
      let tramToTransferDistance = '', tramToTransferDuration = '';
      const nearestTram = await findNearestTram(startStation, startColors);
      if (!nearestTram) {
        alert('No suitable tram found with matching colors. Please check if any trams are available.');
        return;
      }
      const tramColor = nearestTram.color;
      const tramRoute = adminRoutes[tramColor.toLowerCase()];
      if (!tramRoute || !Array.isArray(tramRoute) || tramRoute.length === 0) {
        alert('No fixed route found for the nearest tram color.');
        return;
      }
      // 2. Find all stations along the tram's route
      const allStations = stations;
      const routeStations = allStations.filter(station =>
        tramRoute.some(point => {
          const dist = Math.sqrt(Math.pow(point.lat - station.lat, 2) + Math.pow(point.lng - station.lng, 2));
          return dist < 0.0005; // ~50m threshold
        })
      );
      // 3. For each station along the tram's route (before destination), check if it shares a color with the destination
      let transferStation = null;
      for (const station of routeStations) {
        if (station.id === startStation.id) continue;
        const transferColors = station.colors || [];
        if (transferColors.some(color => endColors.includes(color))) {
          transferStation = station;
          break;
        }
      }
      if (!transferStation) {
        alert('No suitable transfer station found. Please try a different route.');
        return;
      }
      // Add marker for transfer station
      await createMarker(transferStation, 'transfer');
      // 4. Draw polyline from first tram to origin (always draw)
      let firstLegSegment = await getRouteSegment(tramColor, startStation, transferStation);
      console.log('First leg segment:', firstLegSegment);
      if (!firstLegSegment || firstLegSegment.length < 2) {
        alert('No valid fixed route found for the first leg.');
        return;
      }
      // Draw first leg polyline
      const firstLegPolyline = new google.maps.Polyline({
        path: firstLegSegment,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: getColorHex(tramColor)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(tramColor),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      polylinesRef.current.push(firstLegPolyline);
      // Draw tram-to-origin polyline
      const firstTram = await findNearestTram(startStation, [tramColor]);
      if (firstTram) {
        const tramToStartPolyline = new google.maps.Polyline({
          path: [
            { lat: firstTram.lat, lng: firstTram.lng },
            { lat: startStation.lat, lng: startStation.lng }
          ],
          icons: [{
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 4,
              strokeColor: getColorHex(tramColor)
            },
            offset: '20%',
            repeat: '150px'
          }],
          strokeColor: getColorHex(tramColor),
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: mapInstanceRef.current
        });
        polylinesRef.current.push(tramToStartPolyline);
      }
      // 5. Draw polyline from transfer station to destination (using a color shared with destination)
      const transferColors = transferStation.colors || [];
      const transferToDestColor = transferColors.find(color => endColors.includes(color));
      let secondLegSegment = await getRouteSegment(transferToDestColor, transferStation, endStation);
      console.log('Second leg segment:', secondLegSegment);
      if (!secondLegSegment || secondLegSegment.length < 2) {
        alert('No valid fixed route found for the second leg.');
        return;
      }
      // Draw second leg polyline
      const secondLegPolyline = new google.maps.Polyline({
        path: secondLegSegment,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: getColorHex(transferToDestColor)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(transferToDestColor),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      polylinesRef.current.push(secondLegPolyline);
      // Draw tram-to-transfer polyline
      const secondTram = await findNearestTram(transferStation, [transferToDestColor]);
      if (secondTram) {
        const tramToTransferPolyline = new google.maps.Polyline({
          path: [
            { lat: secondTram.lat, lng: secondTram.lng },
            { lat: transferStation.lat, lng: transferStation.lng }
          ],
          icons: [{
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 4,
              strokeColor: getColorHex(transferToDestColor)
            },
            offset: '20%',
            repeat: '150px'
          }],
          strokeColor: getColorHex(transferToDestColor),
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: mapInstanceRef.current
        });
        polylinesRef.current.push(tramToTransferPolyline);
      }
      // Set up for real-time update of both legs
      mainRouteSegmentRef.current = firstLegSegment;
      mainRouteColorRef.current = tramColor;
      secondRouteSegmentRef.current = secondLegSegment;
      secondRouteColorRef.current = transferToDestColor;

      // Calculate durations for each segment
      const firstLegDuration = await calculateRouteDuration(startStation, transferStation);
      const secondLegDuration = await calculateRouteDuration(transferStation, endStation);
      // For total distance: only sum firstLegSegment and secondLegSegment
      const totalDistance = (parseFloat(calculateRouteDistance(firstLegSegment)) + parseFloat(calculateRouteDistance(secondLegSegment))).toFixed(1) + ' km';
      // For total duration: sum all durations
      const totalMins =
        parseDurationToMinutes(tramToStartDuration) +
        parseDurationToMinutes(firstLegDuration) +
        parseDurationToMinutes(tramToTransferDuration) +
        parseDurationToMinutes(secondLegDuration);
      onRouteInfoUpdate({
        tramToStart: {
          color: tramColor,
          distance: tramToStartDistance,
          duration: tramToStartDuration
        },
        startToTransfer: {
          color: tramColor,
          distance: calculateRouteDistance(firstLegSegment),
          duration: firstLegDuration
        },
        tramToTransfer: {
          color: transferToDestColor,
          distance: tramToTransferDistance,
          duration: tramToTransferDuration
        },
        transferToEnd: {
          color: transferToDestColor,
          distance: calculateRouteDistance(secondLegSegment),
          duration: secondLegDuration
        },
        transferStation: transferStation.nameEn,
        total: {
          label: 'Origin to Transfer to Destination',
          distance: totalDistance,
          duration: totalMins + ' mins'
        }
      });
      alert(`Transfer required at ${transferStation.nameEn}. Please wait for a tram with colors: ${transferToDestColor}`);
      return;
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

  // Update createMarker function to handle transfer stations
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
    } else if (type === 'transfer') {
      markerView = new google.maps.marker.PinElement({
        background: "#2196F3", // Blue color for transfer station
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
    // Clean up all polylines in the array
    polylinesRef.current.forEach(polyline => {
      if (polyline && polyline.setMap) {
        polyline.setMap(null);
      }
    });
    polylinesRef.current = [];

    // Clean up any custom polylines stored as properties
    Object.keys(polylinesRef.current).forEach(key => {
      if (polylinesRef.current[key] && polylinesRef.current[key].setMap) {
        polylinesRef.current[key].setMap(null);
      }
      delete polylinesRef.current[key];
    });

    // Reset route segment refs
    mainRouteSegmentRef.current = null;
    mainRouteColorRef.current = null;
    secondRouteSegmentRef.current = null;
    secondRouteColorRef.current = null;
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
      // Clear previous polylines and markers when origin or destination changes
      cleanupPolylines();
      cleanupMarkers();

      if (origin && destination) {
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
      return remainingMinutes + " min";
    } else if (remainingMinutes === 0) {
      return hours + " hr";
    } else {
      return hours + " hr " + remainingMinutes + " min";
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
