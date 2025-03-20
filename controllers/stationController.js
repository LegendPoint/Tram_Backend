import { adminDb } from '../config/admin.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import stations from JSON file to Firebase
export const importStations = async (req, res) => {
  try {
    const jsonPath = path.join(__dirname, '..', 'Main_database.json');
    const jsonData = await fs.readFile(jsonPath, 'utf8');
    const stationsData = JSON.parse(jsonData).stations;

    // Convert array to object with numeric IDs
    const stationsObject = stationsData.reduce((acc, station) => {
      acc[station.id] = {
        nameEn: station.nameEn,
        nameTh: station.nameTh,
        lat: station.lat,
        lng: station.lng,
        colors: station.colors
      };
      return acc;
    }, {});

    // Import to Firebase
    await adminDb.ref('stations').set(stationsObject);
    res.json({ success: true, message: 'Stations imported successfully' });
  } catch (error) {
    console.error('Error importing stations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all stations
export const getAllStations = async (req, res) => {
  try {
    const snapshot = await adminDb.ref('stations').once('value');
    const stations = snapshot.val();
    res.json({ success: true, data: stations });
  } catch (error) {
    console.error('Error getting stations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a station
export const updateStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    const updates = req.body;
    await adminDb.ref(`stations/${stationId}`).update(updates);
    res.json({ success: true, message: 'Station updated successfully' });
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a station
export const deleteStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    await adminDb.ref(`stations/${stationId}`).remove();
    res.json({ success: true, message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}; 