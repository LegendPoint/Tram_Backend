import React, { useEffect, useRef, useState } from 'react';
import routeEditorService from '../services/routeEditorService';

const COLORS = {
  red: '#F44336',
  blue: '#2196F3',
  green: '#4CAF50'
};

const MergedRouteEditor = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState('red');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [error, setError] = useState(null);
  const pathHistoryRef = useRef([]);
  const currentPathIndexRef = useRef(-1);

  // Initialize map
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

  // Save current path to history
  const saveToHistory = (path) => {
    const currentPath = path.getArray().map(latlng => ({
      lat: latlng.lat(),
      lng: latlng.lng()
    }));
    if (currentPathIndexRef.current < pathHistoryRef.current.length - 1) {
      pathHistoryRef.current = pathHistoryRef.current.slice(0, currentPathIndexRef.current + 1);
    }
    pathHistoryRef.current.push(currentPath);
    currentPathIndexRef.current = pathHistoryRef.current.length - 1;
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (currentPathIndexRef.current > 0) {
      currentPathIndexRef.current--;
      const previousPath = pathHistoryRef.current[currentPathIndexRef.current];
      if (polylineRef.current) {
        polylineRef.current.setPath(previousPath);
      }
    }
  };
  const handleRedo = () => {
    if (currentPathIndexRef.current < pathHistoryRef.current.length - 1) {
      currentPathIndexRef.current++;
      const nextPath = pathHistoryRef.current[currentPathIndexRef.current];
      if (polylineRef.current) {
        polylineRef.current.setPath(nextPath);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load existing route for selected color
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    const loadRoute = async () => {
      try {
        setError(null);
        const path = await routeEditorService.getRouteByColor(selectedColor);
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }
        // Reset history
        pathHistoryRef.current = [path];
        currentPathIndexRef.current = 0;
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
        polylineRef.current.addListener('path_changed', () => {
          saveToHistory(polylineRef.current.getPath());
        });
        // Fit bounds
        if (path.length > 0) {
          const bounds = new window.google.maps.LatLngBounds();
          path.forEach(pt => bounds.extend(pt));
          mapInstanceRef.current.fitBounds(bounds);
        }
      } catch (error) {
        setError('Error loading route: ' + error.message);
      }
    };
    loadRoute();
  }, [selectedColor, isMapLoaded]);

  // Add points to polyline by clicking on the map
  useEffect(() => {
    if (!isMapLoaded || !mapInstanceRef.current) return;
    const clickHandler = (e) => {
      if (!polylineRef.current) return;
      polylineRef.current.getPath().push(e.latLng);
      saveToHistory(polylineRef.current.getPath());
    };
    const map = mapInstanceRef.current;
    const listener = map.addListener('click', clickHandler);
    return () => {
      window.google.maps.event.removeListener(listener);
    };
  }, [isMapLoaded, selectedColor]);

  // Save route
  const handleSave = async () => {
    if (!polylineRef.current) return;
    try {
      setError(null);
      const path = polylineRef.current.getPath().getArray().map(latlng => ({
        lat: latlng.lat(),
        lng: latlng.lng()
      }));
      await routeEditorService.saveRoute(selectedColor, path);
      alert('Route saved successfully!');
    } catch (error) {
      setError('Error saving route: ' + error.message);
      alert('Error saving route: ' + error.message);
    }
  };

  // Delete route
  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete the ${selectedColor} route? This action cannot be undone.`)) {
      try {
        setError(null);
        await routeEditorService.deleteRoute(selectedColor);
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
          polylineRef.current = null;
        }
        pathHistoryRef.current = [[]];
        currentPathIndexRef.current = 0;
        alert('Route deleted successfully!');
      } catch (error) {
        setError('Error deleting route: ' + error.message);
        alert('Error deleting route: ' + error.message);
      }
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Route Editor</h2>
      {error && (
        <div style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      <div style={{ marginBottom: 8 }}>
        <label htmlFor="route-color">Route Color: </label>
        <select
          id="route-color"
          value={selectedColor}
          onChange={e => setSelectedColor(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginRight: '12px' }}
        >
          <option value="red">Red Route</option>
          <option value="blue">Blue Route</option>
          <option value="green">Green Route</option>
        </select>
        <button
          onClick={handleSave}
          style={{ marginRight: 12, padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#28a745', color: 'white', cursor: 'pointer' }}
        >
          Save Route
        </button>
        <button
          onClick={handleDelete}
          style={{ marginRight: 12, backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Delete Route
        </button>
        <button
          onClick={handleUndo}
          style={{ marginRight: 12, backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Undo (Ctrl+Z)
        </button>
        <button
          onClick={handleRedo}
          style={{ backgroundColor: '#6c757d', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Redo (Ctrl+Shift+Z)
        </button>
      </div>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '700px', marginTop: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid #ccc' }}
      />
      <p style={{ marginTop: 12, color: '#555' }}>
        Drag the line or points to edit the route. Click "Save Route" to store changes.<br />
        Use Ctrl+Z to undo and Ctrl+Shift+Z to redo changes.<br />
        Click on points to delete them or drag them to move.
      </p>
    </div>
  );
};

export default MergedRouteEditor; 