import React, { useEffect, useRef, useState } from 'react';
import stationService from '../services/stationService';
import eventService from '../services/eventService';
import tramService from '../services/tramService';
import routeService from '../services/routeService';

// Utility function to find all possible transfer stations between two tram colors
function findTransferStationsBetweenColors(routes, stations, colorA, colorB) {
  // Get the route arrays for each color
  const routeA = routes[colorA]?.id || [];
  const routeB = routes[colorB]?.id || [];

  // Find stations that are present in both routes
  const transferStations = stations.filter(station =>
    routeA.some(id => String(id) === String(station.id)) &&
    routeB.some(id => String(id) === String(station.id))
  );

  // Log the transfer stations' IDs and colors
  transferStations.forEach(station => {
    console.log(`Transfer Station: ID=${station.id}, Colors=${station.colors?.join(', ')}`);
  });

  return transferStations;
}

// Find a valid transfer route from origin to destination based on station colors and routes
// Now returns ALL valid one-transfer routes found.
function findColorBasedTransferRoute(routes, stations, origin, destination) {
  const originColors = origin.colors || [];
  const destinationColors = destination.colors || [];
  const potentialRoutes = []; // Array to store all valid routes

  for (const colorA of originColors) {
    const routeA = routes[colorA]?.id || [];
    for (const stationId of routeA) {
      if (String(stationId) === String(origin.id) || String(stationId) === String(destination.id)) continue;
      const transferStation = stations.find(s => String(s.id) === String(stationId));
      if (!transferStation) continue;
      const transferColors = transferStation.colors || [];
      // Find a color shared with the destination
      const sharedColor = transferColors.find(c => destinationColors.includes(c));
      if (sharedColor) {
        // Check if destination is on the sharedColor route from transferStation
        const routeB = routes[sharedColor]?.id || [];
        if (routeB.some(id => String(id) === String(destination.id))) {
          // Found a valid transfer path! Store it.
          potentialRoutes.push({
            firstLeg: { color: colorA, from: origin, to: transferStation },
            secondLeg: { color: sharedColor, from: transferStation, to: destination },
            transferStation: transferStation
          });
        }
      }
    }
  }
  return potentialRoutes; // Return all potential routes
}

// Add a cache for walking directions
const walkingDirectionsCache = new Map();
// Add a cache for tram/transfer route info
const tramRouteInfoCache = new Map();
const transferRouteInfoCache = new Map();

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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const tramSpeed = 30; // km/h - moved to top level for consistent use
  // Add state for user location
  const [userLocation, setUserLocation] = useState(null);
  // Debounce timer ref for route calculation
  const routeDebounceTimer = useRef(null);

  // Load required Google Maps libraries
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        await Promise.all([
          google.maps.importLibrary("maps"),
          google.maps.importLibrary("routes"),
          google.maps.importLibrary("marker")
        ]);
        console.log('Google Maps libraries loaded successfully');
      } catch (error) {
        console.error('Error loading Google Maps libraries:', error);
      }
    };
    loadLibraries();
  }, []);

  const categories = [
    "All Stations",
    "Academic Building",
    "Institute",
    "Park",
    "Parking Lot",
    "Sports Complex",
    "Dormitory",
    "Hospital",
    "Exit Gate"
  ];

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

  const [hasReachedOrigin, setHasReachedOrigin] = useState(false);

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

      // Add Pan to Current Location button
      const locationButton = document.createElement("button");
      locationButton.textContent = "Pan to Current Location";
      locationButton.classList.add("custom-map-control-button");
      map.controls[window.google.maps.ControlPosition.TOP_CENTER].push(locationButton);
      const infoWindow = new window.google.maps.InfoWindow();
      locationButton.addEventListener("click", () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              infoWindow.setPosition(pos);
              infoWindow.setContent("Location found.");
              infoWindow.open(map);
              map.setCenter(pos);
              // Optionally: Add a marker at the current location
              new window.google.maps.Marker({
                position: pos,
                map: map,
                title: "Your Location"
              });
            },
            () => {
              handleLocationError(true, infoWindow, map.getCenter());
            }
          );
        } else {
          // Browser doesn't support Geolocation
          handleLocationError(false, infoWindow, map.getCenter());
        }
      });
      function handleLocationError(browserHasGeolocation, infoWindow, pos) {
        infoWindow.setPosition(pos);
        infoWindow.setContent(
          browserHasGeolocation
            ? "Error: The Geolocation service failed."
            : "Error: Your browser doesn't support geolocation."
        );
        infoWindow.open(map);
      }

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
    if (selectedCategory !== null || isSimulating) {
      // Hide event markers when filter is active or simulation is running
      eventMarkersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
      eventMarkersRef.current = [];
      return;
    }
    const unsubscribe = eventService.getAllEvents(async (eventsData) => {
      try {
        setEvents(eventsData);
        eventMarkersRef.current.forEach(marker => marker.setMap(null));
        eventMarkersRef.current = [];
        const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
        eventsData.forEach(event => {
          if (event.location) {
            const eventEndDate = new Date(event.endDate);
            const currentDate = new Date();
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
                    <div style="padding: 10px; max-width: 250px;">
                      <h3>${event.name}</h3>
                      ${event.imageUrl ? `<img src="${event.imageUrl}" alt="Event" style="width:100%;max-height:120px;object-fit:cover;margin-bottom:8px;" />` : ''}
                      <p>${event.description}</p>
                      <p><strong>Start:</strong> ${new Date(event.startDate).toLocaleString()}</p>
                      <p><strong>End:</strong> ${new Date(event.endDate).toLocaleString()}</p>
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
  }, [isMapLoaded, selectedCategory, isSimulating]);

  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    if (selectedCategory !== null) {
      // Hide tram markers when filter is active
      tramMarkersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
      tramMarkersRef.current.clear();
      return;
    }
    const unsubscribe = tramService.getAllTramPositions(async (positionsArray) => {
      try {
        setTramPositions(positionsArray);
        await updateTramMarkers(positionsArray);
      } catch (error) {
        console.error('Error loading tram positions:', error);
      }
    });
    return () => unsubscribe();
  }, [isMapLoaded, selectedCategory]);

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

  // Helper function to calculate route duration using Google Maps API ONLY FOR WALKING
  const calculateRouteDuration = async (origin, destination, mode = 'tram', adminRoute = null) => {
    try {
      if (mode === 'walk') {
        // Use Google Directions API for walking
        const { DirectionsService } = await google.maps.importLibrary("routes");
        const directionsService = new DirectionsService();
        return new Promise((resolve, reject) => {
          directionsService.route(
            {
              origin: { lat: origin.lat, lng: origin.lng },
              destination: { lat: destination.lat, lng: destination.lng },
              travelMode: google.maps.TravelMode.WALKING,
            },
            (result, status) => {
              if (status === "OK") {
                const duration = result.routes[0].legs[0].duration.text;
                resolve(duration);
              } else {
                // fallback to straight-line walking
                const distance = google.maps.geometry.spherical.computeDistanceBetween(
                  { lat: origin.lat, lng: origin.lng },
                  { lat: destination.lat, lng: destination.lng }
                ) / 1000;
                const averageWalkingSpeed = 5; // km/h
                const durationInHours = distance / averageWalkingSpeed;
                const hours = Math.floor(durationInHours);
                const minutes = Math.round((durationInHours - hours) * 60);
                resolve(hours === 0 ? minutes + " min" : hours + " hr " + minutes + " min");
              }
            }
          );
        });
      } else {
        // For tram (DRIVING), use fixed route (adminRoutes) and tram speed
        if (!adminRoute) {
          // fallback to straight-line if adminRoute not provided
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            { lat: origin.lat, lng: origin.lng },
            { lat: destination.lat, lng: destination.lng }
          ) / 1000;
          const durationInHours = distance / tramSpeed;
          const hours = Math.floor(durationInHours);
          const minutes = Math.round((durationInHours - hours) * 60);
          return (hours === 0 ? minutes + " min" : hours + " hr " + minutes + " min");
        }
        // Calculate distance along the fixed route
        const distanceKm = await calculateDistanceAlongRoute(adminRoute, origin, destination);
        const durationInHours = distanceKm / tramSpeed;
        const hours = Math.floor(durationInHours);
        const minutes = Math.round((durationInHours - hours) * 60);
        return (hours === 0 ? minutes + " min" : hours + " hr " + minutes + " min");
      }
    } catch (error) {
      console.error("Error in calculateRouteDuration:", error);
      // fallback to straight-line
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng }
      ) / 1000;
      const fallbackSpeed = mode === 'walk' ? 5 : tramSpeed;
      const durationInHours = distance / fallbackSpeed;
      const hours = Math.floor(durationInHours);
      const minutes = Math.round((durationInHours - hours) * 60);
      return (hours === 0 ? minutes + " min" : hours + " hr " + minutes + " min");
    }
  };

  // Helper function to calculate distance along a geographic route between two points
  const calculateDistanceAlongRoute = async (geographicRoute, startPoint, endPoint) => {
    if (!geographicRoute || geographicRoute.length < 2) return 0;

    const startPointIndex = await findClosestPointIndex(geographicRoute, startPoint);
    const endPointIndex = await findClosestPointIndex(geographicRoute, endPoint);

    // If start and end are the same point or very close on the route, distance is negligible
    if (startPointIndex === endPointIndex) {
        // Could add a small distance if they are not exactly the same coordinate but map to the same index
        // but for simplicity, let's return 0 if they map to the same index.
        return 0;
    }

    let totalDistance = 0;
    let currentIndex = startPointIndex;
    const routeLength = geographicRoute.length;
    let steps = 0;

    // Determine the direction of traversal along the geographic route
    // This is tricky for circular routes. A simple approach is to see if the endPointIndex is ahead 
    // or behind the startPointIndex in the array order, potentially wrapping around.
    // A more robust approach would align with the logical route direction if available, but this helper
    // is just for geographic distance along adminRoutes.
    // Let's assume for simplicity that the shorter path along the geographic polyline is intended.

    // Calculate distance traversing forwards
    let distanceForward = 0;
    let currentIdxForward = startPointIndex;
    let stepsForward = 0;
    while (currentIdxForward !== endPointIndex && stepsForward < routeLength) {
        const nextIdx = (currentIdxForward + 1) % routeLength;
        distanceForward += google.maps.geometry.spherical.computeDistanceBetween(
            geographicRoute[currentIdxForward],
            geographicRoute[nextIdx]
        );
        currentIdxForward = nextIdx;
        stepsForward++;
    }

    // Calculate distance traversing backwards
    let distanceBackward = 0;
    let currentIdxBackward = startPointIndex;
    let stepsBackward = 0;
     while (currentIdxBackward !== endPointIndex && stepsBackward < routeLength) {
        const prevIdx = (currentIdxBackward - 1 + routeLength) % routeLength;
         distanceBackward += google.maps.geometry.spherical.computeDistanceBetween(
             geographicRoute[currentIdxBackward],
             geographicRoute[prevIdx]
         );
         currentIdxBackward = prevIdx;
         stepsBackward++;
    }

    // Choose the shorter distance
    totalDistance = Math.min(distanceForward, distanceBackward);

    return totalDistance / 1000; // Return distance in kilometers
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

  // Helper to parse duration string (e.g., '1 hr 5 min', '28 min', '3 hours 56 mins') to minutes
  const parseDurationToMinutes = (durationStr) => {
    let total = 0;
    if (!durationStr) return 0;
    // Match all variations of hour/minute
    const hrMatch = durationStr.match(/(\d+)\s*(hr|hrs|hour|hours)/i);
    const minMatch = durationStr.match(/(\d+)\s*(min|mins|minute|minutes)/i);
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

  // Helper: find closest point on a path to a given point
  const findClosestPointOnPath = (path, point) => {
    let minDistance = Infinity;
    let closestPoint = null;
    
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      
      // Calculate the closest point on the line segment
      const closest = findClosestPointOnLineSegment(
        point.lat, point.lng,
        start.lat, start.lng,
        end.lat, end.lng
      );
      
      const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closest);
      
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
    // Remove all previous main route polylines
    cleanupPolylines();
    const routeSegment = mainRouteSegmentRef.current;
    const color = mainRouteColorRef.current;
    const tramIdx = findClosestIndexOnPath(routeSegment, currentTramPos);
    // Calculate distance from tram to closest point on route
    const tramPoint = currentTramPos;
    const closestRoutePoint = routeSegment[tramIdx];
    const THRESHOLD = 0.0003; // ~30 meters

    // Find the origin station (first point in the route segment)
    const originPoint = routeSegment[0];
    const distToOrigin = Math.sqrt(Math.pow(tramPoint.lat - originPoint.lat, 2) + Math.pow(tramPoint.lng - originPoint.lng, 2));

    // Step 1: Wait for tram to reach the origin
    if (!hasReachedOrigin && distToOrigin < 0.0002) {
      setHasReachedOrigin(true);
      // Optionally, alert('Tram has reached the origin station!');
    }

    // Step 2: Only allow simulation to end if tram has reached the origin first
    if (hasReachedOrigin) {
      // End simulation if tram is at/near the destination
      const destPoint = routeSegment[routeSegment.length - 1];
      const distToDest = Math.sqrt(Math.pow(tramPoint.lat - destPoint.lat, 2) + Math.pow(tramPoint.lng - destPoint.lng, 2));
      if (distToDest < 0.0002) { // ~20 meters
        setIsSimulating(false);
        setHasReachedOrigin(false); // reset for next simulation
        alert('Tram has reached the destination!');
        return;
      }
    }

    // Tram has NOT reached the origin: show full route in color, no gray segment
    if (!hasReachedOrigin) {
      const remainingPolyline = new google.maps.Polyline({
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
      polylinesRef.current.push(remainingPolyline);
      return;
    }

    // Tram is at/near the origin: show passed (gray) and remaining (colored) segments
    const dist = Math.sqrt(Math.pow(tramPoint.lat - closestRoutePoint.lat, 2) + Math.pow(tramPoint.lng - closestRoutePoint.lng, 2));
    if (dist > THRESHOLD) {
      // Tram is not on/near the route: show full route in color, no gray segment
      const remainingPolyline = new google.maps.Polyline({
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
      polylinesRef.current.push(remainingPolyline);
      return;
    }
    // Passed segment: from start to tramIdx
    if (tramIdx > 0) {
      const passedPolyline = new google.maps.Polyline({
        path: routeSegment.slice(0, tramIdx + 1),
        strokeColor: '#888888',
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      polylinesRef.current.push(passedPolyline);
    }
    // Remaining segment: from tramIdx to end
    const remainingPolyline = new google.maps.Polyline({
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
    polylinesRef.current.push(remainingPolyline);
  }, [currentTramPos]);

  // Real-time update for second tram (transfer route)
  useEffect(() => {
    if (!secondRouteSegmentRef.current || !secondRouteColorRef.current || !secondTramPos || !mapInstanceRef.current) return;
    // Remove all previous second route polylines
    cleanupPolylines();
    const routeSegment = secondRouteSegmentRef.current;
    const color = secondRouteColorRef.current;
    const tramIdx = findClosestIndexOnPath(routeSegment, secondTramPos);
    // Calculate distance from tram to closest point on route
    const tramPoint = secondTramPos;
    const closestRoutePoint = routeSegment[tramIdx];
    const dist = Math.sqrt(Math.pow(tramPoint.lat - closestRoutePoint.lat, 2) + Math.pow(tramPoint.lng - closestRoutePoint.lng, 2));
    const THRESHOLD = 0.0003; // ~30 meters

    // End simulation if tram is at/near the destination
    const destPoint = routeSegment[routeSegment.length - 1];
    const distToDest = Math.sqrt(Math.pow(tramPoint.lat - destPoint.lat, 2) + Math.pow(tramPoint.lng - destPoint.lng, 2));
    if (distToDest < 0.0002) { // ~20 meters
      setIsSimulating(false);
      alert('Tram has reached the destination!');
      return;
    }

    if (dist > THRESHOLD) {
      // Tram is not on/near the route: show full route in color, no gray segment
      const remainingPolyline = new google.maps.Polyline({
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
      polylinesRef.current.push(remainingPolyline);
      return;
    }
    // Passed segment: from start to tramIdx
    if (tramIdx > 0) {
      const passedPolyline = new google.maps.Polyline({
        path: routeSegment.slice(0, tramIdx + 1),
        strokeColor: '#888888',
        strokeOpacity: 0.7,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      polylinesRef.current.push(passedPolyline);
    }
    // Remaining segment: from tramIdx to end
    const remainingPolyline = new google.maps.Polyline({
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
    polylinesRef.current.push(remainingPolyline);
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

  // Add this new function before displayRoute
  const findNearestStationWithCommonColors = async (currentLocation, destination, allStations) => {
    try {
      const { DirectionsService } = await google.maps.importLibrary("routes");
      const directionsService = new DirectionsService();
      
      let nearestStation = null;
      let minDistance = Infinity;
      const destinationColors = destination.colors || [];

      for (const station of allStations) {
        const stationColors = station.colors || [];
        const hasCommonColor = stationColors.some(color => destinationColors.includes(color));
        
        if (hasCommonColor) {
          const result = await new Promise((resolve, reject) => {
            directionsService.route(
              {
                origin: { lat: currentLocation.lat, lng: currentLocation.lng },
                destination: { lat: station.lat, lng: station.lng },
                travelMode: google.maps.TravelMode.WALKING,
              },
              (result, status) => {
                if (status === "OK") {
                  resolve(result);
                } else {
                  reject(new Error(`Directions request failed: ${status}`));
                }
              }
            );
          });

          const distance = result.routes[0].legs[0].distance.value;
          if (distance < minDistance) {
            minDistance = distance;
            nearestStation = {
              ...station,
              walkingPath: result.routes[0].overview_path,
              walkingDistance: result.routes[0].legs[0].distance.text,
              walkingDuration: result.routes[0].legs[0].duration.text
            };
          }
        }
      }

      return nearestStation;
    } catch (error) {
      console.error('Error finding nearest station with common colors:', error);
      return null;
    }
  };

  // Modify the displayRoute function to use the new walking path
  const displayRoute = async (startStation, endStation) => {
    setIsSimulating(true);
    // Clean up only polylines and markers, but keep tram markers
    cleanupPolylines();
    cleanupStationMarkers();
    // Remove all event markers
    eventMarkersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
    eventMarkersRef.current = [];
    // Remove all tram markers
    tramMarkersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
    tramMarkersRef.current.clear();
    mainRouteSegmentRef.current = null;
    mainRouteColorRef.current = null;
    secondRouteSegmentRef.current = null;
    secondRouteColorRef.current = null;
    setCurrentTramPos(null);
    setSecondTramPos(null);
    onRouteInfoUpdate({});
    let firstTram = null;
    let secondTram = null;
    let walkingToStationInfo = null;
    try {
      if (!startStation || !endStation) {
        setIsSimulating(false);
        console.error('Start or end station is undefined');
        return;
      }

      console.log('Displaying route for stations:', { startStation, endStation });

      if (startStation.id === endStation.id) {
        setIsSimulating(false);
        alert('Origin and destination cannot be the same. Please select different locations.');
        return;
      }

      // Check if stations are too close (within 150 meters)
      if (
        typeof startStation.lat !== 'number' || typeof startStation.lng !== 'number' ||
        typeof endStation.lat !== 'number' || typeof endStation.lng !== 'number'
      ) {
        setIsSimulating(false);
        console.error('Invalid coordinates:', startStation, endStation);
        alert('One of the selected locations is missing coordinates. Please try again.');
        return;
      }
      const distance = google.maps.geometry.spherical.computeDistanceBetween(
        { lat: startStation.lat, lng: startStation.lng },
        { lat: endStation.lat, lng: endStation.lng }
      );
      if (distance <= 150) { // 150 meters
        setIsSimulating(false);
        alert('Origin and destination are too close (within 150 meters). Please select locations that are further apart.');
        // Restore tram markers
        updateTramMarkers(tramPositions);
        // Restore event markers
        eventService.getAllEvents(async (eventsData) => {
          setEvents(eventsData);
          eventMarkersRef.current.forEach(marker => marker.setMap(null));
          eventMarkersRef.current = [];
          const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
          eventsData.forEach(event => {
            if (event.location) {
              const eventEndDate = new Date(event.endDate);
              const currentDate = new Date();
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
                eventMarkersRef.current.push(marker);
              }
            }
          });
        });
        return;
      }

      // Always create markers for start and end stations
      console.log('Creating marker for origin (nearest):', startStation);
      await createMarker(startStation, 'nearest');
      console.log('Created marker for origin (nearest)');
      console.log('Creating marker for destination:', endStation);
      await createMarker(endStation, 'destination');
      console.log('Created marker for destination');

      // If startStation is a current location (has lat/lng but no id)
      if (startStation.lat && startStation.lng && (startStation.id === 'current' || !startStation.id)) {
        const allStations = stations;
        // Find the nearest station (regardless of color)
        let nearestStation = null;
        let minDistance = Infinity;
        for (const station of allStations) {
          const distance = google.maps.geometry.spherical.computeDistanceBetween(
            { lat: startStation.lat, lng: startStation.lng },
            { lat: station.lat, lng: station.lng }
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestStation = station;
          }
        }
        if (!nearestStation) {
          alert('No tram stations found.');
          return;
        }

        let walkingResult = null;
        // --- Caching logic ---
        const cacheKey = `${startStation.lat},${startStation.lng}|${nearestStation.lat},${nearestStation.lng}`;
        if (walkingDirectionsCache.has(cacheKey)) {
          walkingResult = walkingDirectionsCache.get(cacheKey);
          console.log('Using cached walking directions result for', cacheKey);
        } else {
          try {
            console.log('Loading Directions API...');
            const { DirectionsService } = await google.maps.importLibrary("routes");
            console.log('Directions API loaded successfully');
            
            const directionsService = new DirectionsService();
            console.log('DirectionsService instance created');
            
            console.log('Requesting walking directions from:', {
              origin: { lat: startStation.lat, lng: startStation.lng },
              destination: { lat: nearestStation.lat, lng: nearestStation.lng }
            });

            walkingResult = await new Promise((resolve, reject) => {
              directionsService.route(
                {
                  origin: { lat: startStation.lat, lng: startStation.lng },
                  destination: { lat: nearestStation.lat, lng: nearestStation.lng },
                  travelMode: google.maps.TravelMode.WALKING,
                },
                (result, status) => {
                  console.log('Directions API response:', { status, result });
                  if (status === "OK") {
                    resolve(result);
                  } else {
                    console.error('Directions API error:', status);
                    resolve(null);
                  }
                }
              );
            });
            // Store in cache
            walkingDirectionsCache.set(cacheKey, walkingResult);
          } catch (error) {
            console.error('Error creating walking route:', error);
            // Fallback to straight line if Directions API fails
            if (mapInstanceRef.current) {
              let walkingPolyline = new google.maps.Polyline({
                path: [
                  { lat: startStation.lat, lng: startStation.lng },
                  { lat: nearestStation.lat, lng: nearestStation.lng }
                ],
                strokeColor: '#FF9800',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                map: mapInstanceRef.current
              });
              polylinesRef.current.push(walkingPolyline);
            }
          }
        }
        // --- Drawing polyline (no redeclaration) ---
        let walkingPolyline;
        if (walkingResult && walkingResult.routes && walkingResult.routes[0] && walkingResult.routes[0].overview_path) {
          console.log('Drawing walking path with Directions API result');
          const overviewPath = walkingResult.routes[0].overview_path.map(latlng => ({ lat: latlng.lat(), lng: latlng.lng() }));
          console.log('Overview path points:', overviewPath.length);
          if (!mapInstanceRef.current) {
            console.error('Map instance is not available');
            return;
          }
          walkingPolyline = new google.maps.Polyline({
            path: overviewPath,
            strokeColor: '#FF9800',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            icons: [{
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 3,
                strokeColor: '#FF9800'
              },
              offset: '20%',
              repeat: '150px'
            }],
            map: mapInstanceRef.current
          });
          console.log('Created walking polyline:', walkingPolyline);
          polylinesRef.current.push(walkingPolyline);
        } else {
          console.log('No valid walking path found, using straight line fallback');
          if (!mapInstanceRef.current) {
            console.error('Map instance is not available');
            return;
          }
          walkingPolyline = new google.maps.Polyline({
            path: [
              { lat: startStation.lat, lng: startStation.lng },
              { lat: nearestStation.lat, lng: nearestStation.lng }
            ],
            strokeColor: '#FF9800',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map: mapInstanceRef.current
          });
          console.log('Created straight line polyline:', walkingPolyline);
          polylinesRef.current.push(walkingPolyline);
        }
        await createMarker(startStation, 'current');
        await createMarker(nearestStation, 'nearest');
        await createMarker(endStation, 'destination');
        walkingToStationInfo = walkingResult ? {
          color: 'walking',
          distance: walkingResult.routes[0].legs[0].distance.text,
          duration: walkingResult.routes[0].legs[0].duration.text
        } : null;
        onRouteInfoUpdate({ walkingToStation: walkingToStationInfo });
        // Continue with the route from nearest station to destination (including transfer logic)
        startStation = nearestStation;
      }

      const startColors = startStation.colors || [];
      const endColors = endStation.colors || [];
      const commonColors = startColors.filter(color => endColors.includes(color));

      // Fetch both the coordinate-based routes (for map drawing) and the logical routes (for calculations)
      const { adminRoutes, routes: logicalRoutesData } = await routeService.getAllRoutes();
      console.log('Available adminRoutes (for map):', adminRoutes);
      console.log('Available logicalRoutesData (for logic):', logicalRoutesData);

      // DEBUG: Check the structure of specific routes within logicalRoutesData
      console.log('DEBUG: Structure of logicalRoutesData.Green:', logicalRoutesData?.Green);
      console.log('DEBUG: Structure of logicalRoutesData.Red:', logicalRoutesData?.Red);

      // Helper to get fixed route segment between two stations
      const getRouteSegment = async (color, fromStation, toStation) => {
        const colorKey = color.toLowerCase();
        // Use adminRoutes for geographic path
        const geographicRoute = adminRoutes[colorKey];
        if (!geographicRoute || !Array.isArray(geographicRoute) || geographicRoute.length === 0) return null;

        // Find the indices on the geographic route closest to the stations' coordinates
        const fromPointIndex = await findClosestPointIndex(geographicRoute, { lat: fromStation.lat, lng: fromStation.lng });
        const toPointIndex = await findClosestPointIndex(geographicRoute, { lat: toStation.lat, lng: toStation.lng });

        // Always traverse forward along the route (wrap around if needed)
        let segment = [];
        let idx = fromPointIndex;
        while (idx !== toPointIndex) {
          segment.push(geographicRoute[idx]);
          idx = (idx + 1) % geographicRoute.length;
        }
        segment.push(geographicRoute[toPointIndex]);
        return segment;
      };

      // Direct route (common color)
      if (commonColors.length > 0) {
        let bestTotalDuration = Infinity;
        let selectedColor = null;
        let finalNearestTram = null;
        let bestTramToStartDistance = '';
        let bestTramToStartDuration = '';

        // For each common color, calculate total journey time
        for (const color of commonColors) {
          // --- Caching logic for tram route info ---
          const tramCacheKey = `${startStation.id}|${endStation.id}|${color}`;
          let cachedTramInfo = tramRouteInfoCache.get(tramCacheKey);
          if (cachedTramInfo) {
            // Use cached info
            if (cachedTramInfo.totalDuration < bestTotalDuration) {
              bestTotalDuration = cachedTramInfo.totalDuration;
              selectedColor = color;
              finalNearestTram = cachedTramInfo.nearestTram;
              bestTramToStartDistance = cachedTramInfo.tramToStartDistance;
              bestTramToStartDuration = cachedTramInfo.tramToStartDuration;
            }
            continue;
          }
          // Find nearest tram of this color
          const nearestTram = await findNearestTram(startStation, [color]);
          if (!nearestTram) continue;

          // Get route segment from origin to destination
          const routeSegment = await getRouteSegment(color, startStation, endStation);
          if (!routeSegment || routeSegment.length < 2) continue;

          // Calculate tram-to-origin segment
          const fixedRoute = (adminRoutes[color.toLowerCase()] || []);
          const tramIdx = await findClosestPointIndex(fixedRoute, nearestTram);
          const originIdx = await findClosestPointIndex(fixedRoute, startStation);
          // Always move forward along the route
          const tramToStartDistanceValue = calculateDistanceForward(fixedRoute, tramIdx, originIdx);
          const tramToStartDistance = tramToStartDistanceValue.toFixed(1) + ' km';
          const tramToStartDurationMinutes = Math.round((tramToStartDistanceValue / tramSpeed) * 60);
          const tramToStartDuration = formatDurationFromMinutes(tramToStartDurationMinutes);

          const startToEndDuration = await calculateRouteDuration(startStation, endStation);
          // Calculate total duration in minutes
          const totalDuration = tramToStartDurationMinutes + parseDurationToMinutes(startToEndDuration);

          // Store in cache
          tramRouteInfoCache.set(tramCacheKey, {
            totalDuration,
            nearestTram,
            tramToStartDistance,
            tramToStartDuration
          });

          // Update if this is the fastest route so far
          if (totalDuration < bestTotalDuration) {
            bestTotalDuration = totalDuration;
            selectedColor = color;
            finalNearestTram = nearestTram;
            bestTramToStartDistance = tramToStartDistance;
            bestTramToStartDuration = tramToStartDuration;
          }
        }

        if (!selectedColor || !finalNearestTram) {
          setIsSimulating(false);
          alert('No suitable tram found with matching colors. Please check if any trams are available.');
          return;
        }

        setRouteColor(selectedColor);
        let routeSegment = await getRouteSegment(selectedColor, startStation, endStation);
        console.log('Direct routeSegment:', routeSegment);
        if (!routeSegment || routeSegment.length < 2) {
          setIsSimulating(false);
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
        // Find nearest tram for the selected color
        finalNearestTram = await findNearestTram(startStation, [selectedColor]);
        if (!finalNearestTram) {
          setIsSimulating(false);
          alert('No suitable tram found with matching colors. Please check if any trams are available.');
          return;
        }
        // Remove all tram markers and only show the simulation tram
        tramMarkersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
        tramMarkersRef.current.clear();
        await createMarker({ lat: finalNearestTram.lat, lng: finalNearestTram.lng, nameEn: `Tram (${finalNearestTram.color})`, color: finalNearestTram.color }, 'tram');
        // Set up for real-time update
        mainRouteSegmentRef.current = routeSegment;
        mainRouteColorRef.current = selectedColor;
        setCurrentTramPos({ lat: finalNearestTram.lat, lng: finalNearestTram.lng });
        // --- TRAM TO ORIGIN CALCULATION ---
        // Calculate total distance along the fixed route segment from tram to origin
        const tramToStartDistance = bestTramToStartDistance;
        // Calculate duration using average tram speed (e.g., 20 km/h)
        const tramToStartDuration = bestTramToStartDuration;
        // --- END TRAM TO ORIGIN CALCULATION ---

        // --- ORIGIN TO DESTINATION CALCULATION ---
        // Calculate distance and duration along the fixed route segment from origin to destination
        const startToEndDistance = calculateRouteDistance(routeSegment);
        const startToEndDistanceValue = parseFloat(startToEndDistance); // in km
        const startToEndDurationMinutes = Math.round((startToEndDistanceValue / tramSpeed) * 60);
        const startToEndDuration = formatDurationFromMinutes(startToEndDurationMinutes);
        // --- END ORIGIN TO DESTINATION CALCULATION ---

        const totalMins = parseDurationToMinutes(tramToStartDuration) + startToEndDurationMinutes;
        onRouteInfoUpdate({
          tramToStart: {
            color: selectedColor,
            distance: tramToStartDistance,
            duration: tramToStartDuration
          },
          startToEnd: {
            color: selectedColor,
            distance: startToEndDistance,
            duration: startToEndDuration
          },
          total: {
            label: 'Origin to Destination',
            distance: startToEndDistance,
            duration: totalMins + ' mins'
          }
        });
        return;
      }

      // --- TRANSFER LOGIC ---
      // No common color: find transfer station

      // --- NEW TRANSFER LOGIC based on user's refined approach ---
      // For each transfer station candidate, always check walking first
      let preferredTransferRoutes = [];
      let foundTransfer = false;
      for (const originColor of startColors) {
        const polyline = adminRoutes[originColor.toLowerCase()];
        const logicalRoute = logicalRoutesData[originColor]?.id || [];
        if (!polyline || polyline.length === 0 || logicalRoute.length === 0) continue;
        const originIdx = await findClosestPointIndex(polyline, { lat: startStation.lat, lng: startStation.lng });
        for (let i = 1; i < polyline.length && !foundTransfer; i++) {
          const idx = (originIdx + i) % polyline.length;
          const point = polyline[idx];
          for (const station of stations) {
            const dist = google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(point.lat, point.lng),
              new google.maps.LatLng(station.lat, station.lng)
            );
            if (dist <= 25) {
              console.log('Encountered station:', station.nameEn, 'at polyline index', idx);
              if (String(station.id) === String(startStation.id) || String(station.id) === String(endStation.id)) continue;
              const transferColors = station.colors || [];
              const sharedColorWithOrigin = transferColors.find(color => startColors.includes(color));
              const sharedColorWithDestination = transferColors.find(color => endColors.includes(color));
              if (sharedColorWithDestination) {
                // Always check walking first
                const walkingResult = await getWalkingRouteAndDuration(startStation, station);
                if (walkingResult && walkingResult.durationMinutes <= 5) {
                  preferredTransferRoutes.push({
                    firstLeg: { color: originColor, from: startStation, to: station, mode: 'walk' },
                    secondLeg: { color: sharedColorWithDestination, from: station, to: endStation },
                    transferStation: station,
                    walkingPolyline: walkingResult.polyline
                  });
                  foundTransfer = true;
                  break;
                } else if (sharedColorWithOrigin) {
                  const routeB = logicalRoutesData[sharedColorWithDestination]?.id || [];
                  if (routeB.some(id => String(id) === String(endStation.id))) {
                    preferredTransferRoutes.push({
                      firstLeg: { color: originColor, from: startStation, to: station, mode: 'tram' },
                      secondLeg: { color: sharedColorWithDestination, from: station, to: endStation },
                      transferStation: station,
                      walkingPolyline: null
                    });
                    foundTransfer = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
      // If no transfer found, fallback to Tram Station as before
      if (preferredTransferRoutes.length === 0) {
        const tramStation = stations.find(s => s.nameEn === 'Tram Station');
        if (tramStation && tramStation.id !== startStation.id && tramStation.id !== endStation.id) {
          const transferColors = tramStation.colors || [];
          const sharedColorWithOrigin = transferColors.find(color => startColors.includes(color));
          const sharedColorWithDestination = transferColors.find(color => endColors.includes(color));
          if (sharedColorWithOrigin && sharedColorWithDestination) {
            preferredTransferRoutes.push({
              firstLeg: { color: sharedColorWithOrigin, from: startStation, to: tramStation, mode: 'tram' },
              secondLeg: { color: sharedColorWithDestination, from: tramStation, to: endStation },
              transferStation: tramStation,
              walkingPolyline: null
            });
          }
        }
      }
      console.log('DEBUG: Preferred transfer routes found (first encountered on each color, 10m radius):', preferredTransferRoutes);
      if (preferredTransferRoutes.length === 0) {
        // Fallback: use Tram Station as default transfer station
        const defaultTransferStation = stations.find(s => s.nameEn === 'Tram Station' || s.id === 1);
        if (defaultTransferStation && startStation.id !== defaultTransferStation.id && endStation.id !== defaultTransferStation.id) {
          // Find a color shared with origin and transfer, and transfer and destination
          const originColors = startStation.colors || [];
          const transferColors = defaultTransferStation.colors || [];
          const destinationColors = endStation.colors || [];
          const sharedColorWithOrigin = transferColors.find(color => originColors.includes(color));
          const sharedColorWithDestination = transferColors.find(color => destinationColors.includes(color));
          if (sharedColorWithOrigin && sharedColorWithDestination) {
            preferredTransferRoutes.push({
              firstLeg: { color: sharedColorWithOrigin, from: startStation, to: defaultTransferStation, mode: 'tram' },
              secondLeg: { color: sharedColorWithDestination, from: defaultTransferStation, to: endStation },
              transferStation: defaultTransferStation,
              walkingPolyline: null
            });
          } else {
            setIsSimulating(false);
            alert('No suitable transfer station found. Please try a different route.');
            return;
          }
        } else {
          setIsSimulating(false);
          alert('No suitable transfer station found. Please try a different route.');
          return;
        }
      }
      // Evaluate each preferred transfer route and find the best one (minimum estimated total time)
      let bestRoute = null;
      let minTotalEstimatedTime = Infinity;
      for (const route of preferredTransferRoutes) {
        const { firstLeg, secondLeg, transferStation, walkingPolyline } = route;
        // --- Caching logic for transfer route info ---
        const transferCacheKey = `${startStation.id}|${transferStation.id}|${endStation.id}|${firstLeg.color}|${secondLeg.color}`;
        let cachedTransferInfo = transferRouteInfoCache.get(transferCacheKey);
        let tramToStartDurationMinutes = 0;
        let startToTransferDistanceKm = 0;
        let startToTransferDurationMinutes = 0;
        let tramToTransferDurationMinutes = 0;
        let tramToTransferDistanceKm = 0;
        let transferToEndDistanceKm = 0;
        let transferToEndDurationMinutes = 0;
        let tramArrivalTimeMins = 0;
        let tramArrivalDistance = undefined;
        if (cachedTransferInfo) {
          ({
            tramToStartDurationMinutes,
            startToTransferDistanceKm,
            startToTransferDurationMinutes,
            tramToTransferDurationMinutes,
            tramToTransferDistanceKm,
            transferToEndDistanceKm,
            transferToEndDurationMinutes,
            tramArrivalTimeMins,
            tramArrivalDistance
          } = cachedTransferInfo);
        } else {
          if (firstLeg.mode === 'tram') {
            const firstTram = tramPositions.find(tram => tram.color === firstLeg.color);
            if (firstTram) {
              const firstLegGeographicRoute = adminRoutes[firstLeg.color.toLowerCase()];
              const distanceAlongRoute = await calculateDistanceAlongRoute(
                firstLegGeographicRoute,
                { lat: firstTram.lat, lng: firstTram.lng },
                { lat: startStation.lat, lng: startStation.lng }
              );
              tramToStartDurationMinutes = Math.round((distanceAlongRoute / tramSpeed) * 60);
            }
          } else if (firstLeg.mode === 'walk') {
            tramToStartDurationMinutes = 0;
          }
          if (firstLeg.mode === 'tram') {
            startToTransferDistanceKm = await calculateDistanceAlongRoute(
              adminRoutes[firstLeg.color.toLowerCase()],
              { lat: startStation.lat, lng: startStation.lng },
              { lat: transferStation.lat, lng: transferStation.lng }
            );
            startToTransferDurationMinutes = Math.round((startToTransferDistanceKm / tramSpeed) * 60);
          } else if (firstLeg.mode === 'walk' && walkingPolyline) {
            startToTransferDistanceKm = walkingPolyline.distanceKm;
            startToTransferDurationMinutes = walkingPolyline.durationMinutes;
          }
          const secondTram = tramPositions.find(tram => tram.color === secondLeg.color);
          if (secondTram) {
            const secondLegGeographicRoute = adminRoutes[secondLeg.color.toLowerCase()];
            let distanceForward = 0;
            let idxF = await findClosestPointIndex(secondLegGeographicRoute, { lat: secondTram.lat, lng: secondTram.lng });
            let transferIdx = await findClosestPointIndex(secondLegGeographicRoute, { lat: transferStation.lat, lng: transferStation.lng });
            let stepsF = 0;
            while (idxF !== transferIdx && stepsF < secondLegGeographicRoute.length) {
              const nextIdx = (idxF + 1) % secondLegGeographicRoute.length;
              distanceForward += google.maps.geometry.spherical.computeDistanceBetween(
                secondLegGeographicRoute[idxF],
                secondLegGeographicRoute[nextIdx]
              );
              idxF = nextIdx;
              stepsF++;
            }
            let distanceBackward = 0;
            let idxB = await findClosestPointIndex(secondLegGeographicRoute, { lat: secondTram.lat, lng: secondTram.lng });
            let stepsB = 0;
            while (idxB !== transferIdx && stepsB < secondLegGeographicRoute.length) {
              const prevIdx = (idxB - 1 + secondLegGeographicRoute.length) % secondLegGeographicRoute.length;
              distanceBackward += google.maps.geometry.spherical.computeDistanceBetween(
                secondLegGeographicRoute[idxB],
                secondLegGeographicRoute[prevIdx]
              );
              idxB = prevIdx;
              stepsB++;
            }
            tramToTransferDistanceKm = Math.min(distanceForward, distanceBackward) / 1000;
            tramToTransferDurationMinutes = Math.round((tramToTransferDistanceKm / tramSpeed) * 60);
          }
          transferToEndDistanceKm = await calculateDistanceAlongRoute(
            adminRoutes[secondLeg.color.toLowerCase()],
            { lat: transferStation.lat, lng: transferStation.lng },
            { lat: endStation.lat, lng: endStation.lng }
          );
          transferToEndDurationMinutes = Math.round((transferToEndDistanceKm / tramSpeed) * 60);
          if (firstLeg.mode === 'walk') {
            const transferTram = await findNearestTram(transferStation, [secondLeg.color]);
            if (transferTram) {
              const tramRoute = adminRoutes[secondLeg.color.toLowerCase()];
              tramArrivalDistance = await calculateDistanceAlongRoute(
                tramRoute,
                { lat: transferTram.lat, lng: transferTram.lng },
                { lat: transferStation.lat, lng: transferStation.lng }
              );
              tramArrivalTimeMins = Math.round((tramArrivalDistance / tramSpeed) * 60);
            }
          }
          // Store in cache
          transferRouteInfoCache.set(transferCacheKey, {
            tramToStartDurationMinutes,
            startToTransferDistanceKm,
            startToTransferDurationMinutes,
            tramToTransferDurationMinutes,
            tramToTransferDistanceKm,
            transferToEndDistanceKm,
            transferToEndDurationMinutes,
            tramArrivalTimeMins,
            tramArrivalDistance
          });
        }
        // Calculate total estimated time for this route
        const totalEstimatedTimeMinutes = tramToStartDurationMinutes + startToTransferDurationMinutes + tramToTransferDurationMinutes + transferToEndDurationMinutes;
        console.log(`DEBUG: Preferred Route Option via ${transferStation.nameEn} (${firstLeg.color} then ${secondLeg.color}) - Estimated total time: ${totalEstimatedTimeMinutes} mins`);
        if (totalEstimatedTimeMinutes < minTotalEstimatedTime) {
          minTotalEstimatedTime = totalEstimatedTimeMinutes;
          bestRoute = route;
        }
      }

      // If a best route was found, use it for simulation and display
      if (!bestRoute) {
         // This case should theoretically not be hit if potentialTransferRoutes was not empty,
         // but as a safeguard:
        setIsSimulating(false);
        alert('Could not determine the best transfer route. Please try a different route.');
        return;
      }

      // Use the details of the best route found
      const { firstLeg, secondLeg, transferStation, walkingPolyline } = bestRoute;
      const firstLegColor = firstLeg.color;
      const secondLegColor = secondLeg.color;

      if (!transferStation) {
        setIsSimulating(false);
        alert('No suitable transfer station found. Please try a different route.');
        return;
      }

      // Add marker for transfer station
      await createMarker(transferStation, 'transfer');

      // Draw walking polyline if first leg is walking
      if (firstLeg.mode === 'walk' && walkingPolyline && walkingPolyline.path && walkingPolyline.path.length > 1) {
        // Draw walking polyline (purple/orange)
        const walkingLegPolyline = new google.maps.Polyline({
          path: walkingPolyline.path,
          strokeColor: '#A020F0', // Purple
          strokeOpacity: 0.9,
          strokeWeight: 4,
          icons: [{
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 4,
              strokeColor: '#A020F0'
            },
            offset: '20%',
            repeat: '150px'
          }],
          map: mapInstanceRef.current
        });
        polylinesRef.current.push(walkingLegPolyline);
      }

      // 4. Draw polyline from first tram to origin (always draw) // This comment might be slightly inaccurate now, it's origin to transfer
      let firstLegSegment = null;
      if (firstLeg.mode === 'tram') {
        firstLegSegment = await getRouteSegment(firstLegColor, startStation, transferStation);
      console.log('First leg segment:', firstLegSegment);
      if (!firstLegSegment || firstLegSegment.length < 2) {
        setIsSimulating(false);
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
              strokeColor: getColorHex(firstLegColor)
          },
          offset: '20%',
          repeat: '150px'
        }],
          strokeColor: getColorHex(firstLegColor),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      polylinesRef.current.push(firstLegPolyline);
      }

      // 5. Draw polyline from transfer station to destination (using a color shared with destination)
      let secondLegSegment = await getRouteSegment(secondLegColor, transferStation, endStation);
      console.log('Second leg segment:', secondLegSegment);

      if (!secondLegSegment || secondLegSegment.length < 2) {
        setIsSimulating(false);
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
            strokeColor: getColorHex(secondLegColor)
          },
          offset: '20%',
          repeat: '150px'
        }],
        strokeColor: getColorHex(secondLegColor),
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      });
      polylinesRef.current.push(secondLegPolyline);

      // Remove all tram markers and only show the two simulation trams
      tramMarkersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
      tramMarkersRef.current.clear();

      // Show the first tram (for first leg) - find the nearest tram with the first leg color
      if (firstLeg.mode === 'tram') {
        firstTram = await findNearestTram(startStation, [firstLegColor]);
      if (firstTram) {
        await createMarker({ lat: firstTram.lat, lng: firstTram.lng, nameEn: `Tram (${firstTram.color})`, color: firstTram.color }, 'tram');
      }
      }

      // Show the second tram (for second leg) - find the nearest tram with the second leg color
      secondTram = await findNearestTram(transferStation, [secondLegColor]);
      if (secondTram) {
        await createMarker({ lat: secondTram.lat, lng: secondTram.lng, nameEn: `Tram (${secondTram.color})`, color: secondTram.color }, 'tram');
      }

      // Set up for real-time update of both legs
      mainRouteSegmentRef.current = firstLegSegment;
      mainRouteColorRef.current = firstLegColor;
      secondRouteSegmentRef.current = secondLegSegment;
      secondRouteColorRef.current = secondLegColor;

      // --- RECALCULATE tramToTransferDistanceKm and tramToTransferDurationMinutes for bestRoute ---
      let tramToTransferDistanceKm = 0;
      let tramToTransferDurationMinutes = 0;
      if (secondTram) {
        const secondLegRoute = adminRoutes[secondLeg.color.toLowerCase()];
        const tramIdx = await findClosestPointIndex(secondLegRoute, { lat: secondTram.lat, lng: secondTram.lng });
        const transferIdx = await findClosestPointIndex(secondLegRoute, { lat: transferStation.lat, lng: transferStation.lng });
        tramToTransferDistanceKm = calculateDistanceForward(secondLegRoute, tramIdx, transferIdx);
        tramToTransferDurationMinutes = Math.round((tramToTransferDistanceKm / tramSpeed) * 60);
      }
      // --- END RECALCULATION ---

      // --- TRAM TO ORIGIN CALCULATION --- // This section might need review based on the new logic
      // Calculate total distance along the fixed route segment from first tram to origin
      // This calculation needs to be based on the firstLegColor route
      let tramToStartDistance = '';
      let tramToStartDuration = '';
      if (firstTram) {
        const firstLegRoute = adminRoutes[firstLegColor.toLowerCase()];
        const tramIdx = await findClosestPointIndex(firstLegRoute, { lat: firstTram.lat, lng: firstTram.lng });
        const originIdx = await findClosestPointIndex(firstLegRoute, { lat: startStation.lat, lng: startStation.lng });
        const tramToStartDistanceValue = calculateDistanceForward(firstLegRoute, tramIdx, originIdx);
        tramToStartDistance = tramToStartDistanceValue.toFixed(1) + ' km';
        const tramToStartDurationMinutes = Math.round((tramToStartDistanceValue / tramSpeed) * 60);
                tramToStartDuration = formatDurationFromMinutes(tramToStartDurationMinutes);
           }
      // --- TRAM TO TRANSFER CALCULATION --- // This is for the second tram reaching the transfer station
      let tramToTransferDistance = '';
      let tramToTransferDuration = '';
       if (secondTram) {
        const secondLegRoute = adminRoutes[secondLegColor.toLowerCase()];
        const tramIdx = await findClosestPointIndex(secondLegRoute, { lat: secondTram.lat, lng: secondTram.lng });
        const transferIdx = await findClosestPointIndex(secondLegRoute, { lat: transferStation.lat, lng: transferStation.lng });
        const tramToTransferDistanceValue = calculateDistanceForward(secondLegRoute, tramIdx, transferIdx);
        tramToTransferDistance = tramToTransferDistanceValue.toFixed(1) + ' km';
        const tramToTransferDurationMinutes = Math.round((tramToTransferDistanceValue / tramSpeed) * 60);
              tramToTransferDuration = formatDurationFromMinutes(tramToTransferDurationMinutes);
           }
      // ... existing code ...

      // --- ORIGIN TO TRANSFER CALCULATION ---
      // Calculate distance and duration along the fixed route segment from origin to transfer
      let startToTransferDistance, startToTransferDuration;
      if (firstLeg.mode === 'tram') {
        startToTransferDistance = calculateRouteDistance(firstLegSegment);
        startToTransferDuration = await calculateRouteDuration(startStation, transferStation, 'tram', adminRoutes[firstLeg.color.toLowerCase()]);
      } else if (firstLeg.mode === 'walk' && walkingPolyline) {
        startToTransferDistance = walkingPolyline.distanceKm.toFixed(2) + ' km';
        startToTransferDuration = formatDurationFromMinutes(walkingPolyline.durationMinutes);
      }
      // --- END ORIGIN TO TRANSFER CALCULATION ---

      // --- Calculate tram arrival time at transfer station (for walking first leg) ---
      let tramArrivalTimeMins = 0;
      let tramArrivalTimeStr = '';
      let tramArrivalDistance = undefined;
      if (firstLeg.mode === 'walk') {
        // Find the nearest tram for the transfer leg
        const transferTram = await findNearestTram(transferStation, [secondLegColor]);
        if (transferTram) {
          const tramRoute = adminRoutes[secondLegColor.toLowerCase()];
          tramArrivalDistance = await calculateDistanceAlongRoute(
            tramRoute,
            { lat: transferTram.lat, lng: transferTram.lng },
            { lat: transferStation.lat, lng: transferStation.lng }
          );
          tramArrivalTimeMins = Math.round((tramArrivalDistance / tramSpeed) * 60); // 30 km/h
          tramArrivalTimeStr = formatDurationFromMinutes(tramArrivalTimeMins);
        }
      }
      let tramToTransferDistanceStr = '';
      if (firstLeg.mode === 'walk' && typeof tramArrivalDistance !== 'undefined') {
        tramToTransferDistanceStr = tramArrivalDistance.toFixed(2) + ' km';
      }

      // --- TRANSFER TO DESTINATION CALCULATION ---
      // Calculate distance along the fixed route segment from transfer to destination
      const transferToEndDistance = calculateRouteDistance(secondLegSegment);
      // Always use tram speed for tram segments
      const transferToEndDistanceValue = parseFloat(transferToEndDistance); // in km
      let transferToEndDurationMinutes = Math.round((transferToEndDistanceValue / tramSpeed) * 60);
      // --- END TRANSFER TO DESTINATION CALCULATION ---

      // For total distance: only sum startToTransfer and transferToEnd
      const totalDistanceValue = (parseFloat(startToTransferDistance) + parseFloat(transferToEndDistance)).toFixed(1);
      const totalDistance = totalDistanceValue + ' km';

      // For total duration: sum all relevant durations
      // For walking transfer: walking + tram waiting + tram ride
      let totalMins = 0;
      let totalLabel = 'Total Journey';
      if (firstLeg.mode === 'walk') {
        // Use numeric values for all segments
        totalMins =
          (walkingPolyline?.durationMinutes || 0) + // walking
          tramArrivalTimeMins + // waiting for tram
          transferToEndDurationMinutes; // tram ride
      } else {
        totalMins =
          parseDurationToMinutes(tramToStartDuration) + // Time for the first tram to reach the origin station
          parseDurationToMinutes(startToTransferDuration) + // Time from origin to transfer station
          parseDurationToMinutes(tramToTransferDuration) + // Time for the second tram to reach the transfer station
          transferToEndDurationMinutes; // Time from transfer station to destination
      }

      // --- Update info container for walking ---
      let firstLegLabel;
      if (firstLeg.mode === 'walk') {
        firstLegLabel = 'Walking: Origin to Transfer Station';
      } else {
        firstLegLabel = firstLegColor.charAt(0).toUpperCase() + firstLegColor.slice(1) + ' Tram: Origin to Transfer Station';
      }
      let firstLegColorLabel = firstLeg.mode === 'walk' ? 'purple' : firstLegColor;
      let firstLegDistance = startToTransferDistance;
      let firstLegDuration = startToTransferDuration;

      if (typeof selectedColor !== 'undefined') {
        // For direct route:
        // Calculate total distance and duration including walkingToStation if present
        let totalDistanceValue = parseFloat(startToEndDistance);
        let totalMins = parseDurationToMinutes(tramToStartDuration) + startToEndDurationMinutes;
        if (walkingToStationInfo && walkingToStationInfo.distance && walkingToStationInfo.duration) {
          // Add walking distance and duration
          const walkDist = parseFloat(walkingToStationInfo.distance);
          const walkMins = parseDurationToMinutes(walkingToStationInfo.duration);
          if (!isNaN(walkDist)) totalDistanceValue += walkDist;
          if (!isNaN(walkMins)) totalMins += walkMins;
        }
        onRouteInfoUpdate({
          ...(walkingToStationInfo ? { walkingToStation: walkingToStationInfo } : {}),
          tramToStart: {
            color: selectedColor,
            distance: tramToStartDistance,
            duration: tramToStartDuration
          },
          startToEnd: {
            color: selectedColor,
            distance: startToEndDistance,
            duration: startToEndDuration
          },
          total: {
            label: 'Origin to Destination',
            distance: totalDistanceValue.toFixed(2) + ' km',
            duration: totalMins + ' mins'
          }
        });
        return;
      } else {
        // For transfer/complex route:
        // Calculate total distance and duration including walkingToStation if present
        let totalDistanceValue = (parseFloat(startToTransferDistance) + parseFloat(transferToEndDistance));
        let totalMins = 0;
        if (firstLeg.mode === 'walk') {
          totalMins =
            (walkingPolyline?.durationMinutes || 0) + // walking
            tramArrivalTimeMins + // waiting for tram
            transferToEndDurationMinutes; // tram ride
        } else {
          totalMins =
            parseDurationToMinutes(tramToStartDuration) + // Time for the first tram to reach the origin station
            parseDurationToMinutes(startToTransferDuration) + // Time from origin to transfer station
            parseDurationToMinutes(tramToTransferDuration) + // Time for the second tram to reach the transfer station
            transferToEndDurationMinutes; // Time from transfer station to destination
        }
        if (walkingToStationInfo && walkingToStationInfo.distance && walkingToStationInfo.duration) {
          const walkDist = parseFloat(walkingToStationInfo.distance);
          const walkMins = parseDurationToMinutes(walkingToStationInfo.duration);
          if (!isNaN(walkDist)) totalDistanceValue += walkDist;
          if (!isNaN(walkMins)) totalMins += walkMins;
        }
        onRouteInfoUpdate({
          ...(walkingToStationInfo ? { walkingToStation: walkingToStationInfo } : {}),
          tramToStart: firstLeg.mode === 'tram' ? {
            color: firstLegColor,
            distance: tramToStartDistance,
            duration: tramToStartDuration,
            label: firstLegColor.charAt(0).toUpperCase() + firstLegColor.slice(1) + ' Tram to Origin Station'
          } : undefined,
          startToTransfer: {
            color: firstLegColorLabel,
            label: firstLegLabel,
            distance: firstLegDistance,
            duration: firstLegDuration
          },
          tramToTransfer: firstLeg.mode === 'walk' ? {
            color: secondLegColor,
            distance: tramToTransferDistanceStr,
            duration: tramArrivalTimeStr,
            label: secondLegColor.charAt(0).toUpperCase() + secondLegColor.slice(1) + ' Tram to Transfer Station'
          } : {
            color: secondLegColor,
            distance: tramToTransferDistanceKm.toFixed(2) + ' km',
            duration: formatDurationFromMinutes(tramToTransferDurationMinutes),
            label: secondLegColor.charAt(0).toUpperCase() + secondLegColor.slice(1) + ' Tram to Transfer Station'
          },
          transferToEnd: {
            color: secondLegColor,
            distance: transferToEndDistance,
            duration: formatDurationFromMinutes(transferToEndDurationMinutes)
          },
          transferStation: transferStation.nameEn,
          total: {
            label: totalLabel,
            distance: totalDistanceValue.toFixed(2) + ' km',
            duration: formatDurationFromMinutes(totalMins)
          }
        });
        alert(`Transfer required at ${transferStation.nameEn}. Please wait for a tram with colors: ${secondLegColor}`);
        return;
      }

    } catch (error) {
      setIsSimulating(false);
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
    } else if (type === 'tram') {
      markerView = new google.maps.marker.PinElement({
        background: getColorHex(location.color || 'gray'),
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

    // Add debug log for marker creation
    if (type === 'nearest' || type === 'destination') {
      console.log(`Creating marker for ${type}:`, location);
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
    polylinesRef.current.forEach(polyline => {
      if (polyline && polyline.setMap) {
        polyline.setMap(null);
      }
    });
    polylinesRef.current = [];
  };

  // Add this new function for station marker cleanup
  const cleanupStationMarkers = () => {
    // Only remove station markers (not trams or events)
    markersRef.current.forEach(marker => marker.setMap && marker.setMap(null));
    markersRef.current = [];
  };

  // Update useEffect to use cleanupStationMarkers instead of cleanupMarkers
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    // Always cleanup first
    cleanupPolylines();
    cleanupStationMarkers();
    onRouteInfoUpdate({}); // Clear info container

    if (origin && destination) {
      // Debounce route calculation
      if (routeDebounceTimer.current) {
        clearTimeout(routeDebounceTimer.current);
      }
      routeDebounceTimer.current = setTimeout(() => {
        displayRoute(origin.station || origin, destination);
      }, 500); // 500ms debounce
    }
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

  // Update category filtering effect
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    if (isSimulating) return;

    // Clear existing markers
    cleanupStationMarkers();

    let stationsToShow = [];
    if (selectedCategory === "All Stations") {
      stationsToShow = stations;
    } else if (selectedCategory) {
      stationsToShow = stations.filter(station => Array.isArray(station.category) && station.category.includes(selectedCategory));
    } else {
      // If nothing selected, show nothing
      stationsToShow = [];
    }

    // Create markers for filtered stations
    stationsToShow.forEach(station => {
      createMarker(station, 'station');
    });

    // Do NOT fit bounds or change map center/zoom here
  }, [selectedCategory, stations, isMapLoaded, isSimulating]);

  // Helper to get walking route and duration using Google Maps Directions API
  async function getWalkingRouteAndDuration(origin, destination) {
    try {
      const { DirectionsService } = await google.maps.importLibrary("routes");
      const directionsService = new DirectionsService();
      return new Promise((resolve, reject) => {
        directionsService.route(
          {
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            travelMode: google.maps.TravelMode.WALKING,
          },
          (result, status) => {
            if (status === "OK") {
              const durationMinutes = Math.round(result.routes[0].legs[0].duration.value / 60);
              const distanceKm = result.routes[0].legs[0].distance.value / 1000;
              const overviewPath = result.routes[0].overview_path.map(latlng => ({ lat: latlng.lat(), lng: latlng.lng() }));
              resolve({ durationMinutes, distanceKm, polyline: { path: overviewPath, durationMinutes, distanceKm } });
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error in getWalkingRouteAndDuration:", error);
      return null;
    }
  }

  // Helper: always calculate forward distance along a circular route
  function calculateDistanceForward(route, fromIdx, toIdx) {
    let distance = 0;
    let idx = fromIdx;
    while (idx !== toIdx) {
      const nextIdx = (idx + 1) % route.length;
      distance += google.maps.geometry.spherical.computeDistanceBetween(
        route[idx],
        route[nextIdx]
      );
      idx = nextIdx;
    }
    return distance / 1000; // in km
  }

  // Function to get current location with high accuracy
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log('User location (high accuracy):', pos);
          setUserLocation(pos);
          // Optionally, pan the map to this location
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(pos);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to retrieve your location. Please check your browser settings.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  // Call getCurrentLocation on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  return (
    <div className="map-section">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={getCurrentLocation} style={{ padding: '6px 12px', borderRadius: 4, background: '#2196F3', color: 'white', border: 'none', cursor: 'pointer' }}>
          Refresh Location
        </button>
      </div>
      <div className="category-filters" style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
            style={{
              backgroundColor: selectedCategory === category ? '#4CAF50' : '#f0f0f0',
              color: selectedCategory === category ? 'white' : 'black',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: selectedCategory === category ? 'bold' : 'normal',
              marginBottom: category === 'All Stations' ? '5px' : undefined
            }}
          >
            {category}
          </button>
        ))}
      </div>
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
