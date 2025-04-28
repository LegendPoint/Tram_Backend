import React, { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, set, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';

const COLORS = {
  red: '#F44336',
  blue: '#2196F3',
  green: '#4CAF50'
};

const RouteEditorPage = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState('red');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const navigate = useNavigate();
  const clickHandlerRef = useRef();

  useEffect(() => {
    if (window.google && window.google.maps && mapRef.current) {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 13.7949357, lng: 100.3188312 },
        zoom: 15
      });
      mapInstanceRef.current = map;
      setIsMapLoaded(true);
    }
  }, []);

  // Load existing route for selected color
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    const db = getDatabase();
    const routeRef = ref(db, `adminRoutes/${selectedColor}`);
    get(routeRef).then(snapshot => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      let path = [];
      if (snapshot.exists()) {
        path = snapshot.val();
      }
      polylineRef.current = new window.google.maps.Polyline({
        path,
        map: mapInstanceRef.current,
        strokeColor: COLORS[selectedColor],
        strokeWeight: 5,
        editable: true,
        draggable: true,
        icons: [{
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4,
            strokeColor: COLORS[selectedColor]
          },
          offset: '20%',
          repeat: '150px'
        }]
      });
      console.log('Polyline created:', polylineRef.current);
      // Fit bounds to route
      if (path.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        path.forEach(pt => bounds.extend(pt));
        mapInstanceRef.current.fitBounds(bounds);
      }
    });
  }, [selectedColor, isMapLoaded]);

  // Add points to polyline by clicking on the map
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;

    clickHandlerRef.current = (e) => {
      if (!polylineRef.current) return;
      console.log('Map clicked at:', e.latLng.toString());
      polylineRef.current.getPath().push(e.latLng);
    };

    const map = mapInstanceRef.current;
    const listener = map.addListener('click', (e) => clickHandlerRef.current(e));

    // Cleanup listener on unmount or color change
    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isMapLoaded, selectedColor]);

  // Save route to Firebase
  const handleSave = () => {
    if (!polylineRef.current) return;
    const path = polylineRef.current.getPath().getArray().map(latlng => ({
      lat: latlng.lat(),
      lng: latlng.lng()
    }));
    const db = getDatabase();
    set(ref(db, `adminRoutes/${selectedColor}`), path)
      .then(() => alert('Route saved!'))
      .catch(err => alert('Error saving route: ' + err));
  };

  return (
    <div style={{ padding: 24 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>Back to Dashboard</button>
      <h2>Route Editor</h2>
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="route-color">Route Color: </label>
        <select id="route-color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}>
          <option value="red">Red Route</option>
          <option value="blue">Blue Route</option>
          <option value="green">Green Route</option>
        </select>
        <button onClick={handleSave} style={{ marginLeft: 12 }}>Save Route</button>
      </div>
      <div ref={mapRef} style={{ width: '100%', height: '700px', marginTop: 8, borderRadius: 8, overflow: 'hidden' }} />
      <p style={{marginTop: 12, color: '#555'}}>Drag the line or points to edit the route. Click "Save Route" to store changes.</p>
    </div>
  );
};

export default RouteEditorPage; 