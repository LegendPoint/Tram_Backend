import React, { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, set, get } from 'firebase/database';

const COLORS = {
  red: '#F44336',
  blue: '#2196F3',
  green: '#4CAF50'
};

const AdminRouteEditor = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState('red');
  const [isMapLoaded, setIsMapLoaded] = useState(false);

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
      if (snapshot.exists()) {
        const path = snapshot.val();
        polylineRef.current = new window.google.maps.Polyline({
          path,
          map: mapInstanceRef.current,
          strokeColor: COLORS[selectedColor],
          strokeWeight: 5,
          editable: true,
          draggable: true
        });
      } else {
        polylineRef.current = new window.google.maps.Polyline({
          path: [],
          map: mapInstanceRef.current,
          strokeColor: COLORS[selectedColor],
          strokeWeight: 5,
          editable: true,
          draggable: true
        });
      }
    });
  }, [selectedColor, isMapLoaded]);

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
    <div>
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="route-color">Route Color: </label>
        <select id="route-color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)}>
          <option value="red">Red Route</option>
          <option value="blue">Blue Route</option>
          <option value="green">Green Route</option>
        </select>
        <button onClick={handleSave} style={{ marginLeft: 12 }}>Save Route</button>
      </div>
      <div ref={mapRef} style={{ width: '100%', height: '400px', marginTop: 8, borderRadius: 8, overflow: 'hidden' }} />
    </div>
  );
};

export default AdminRouteEditor; 