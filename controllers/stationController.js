import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { adminDb } from '../config/adminserver.js';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get all stations
export const getAllStations = async (req, res) => {
  try {
    const stationsRef = adminDb.ref('stations');
    const snapshot = await stationsRef.once('value');
    const stations = snapshot.val();
    res.json(stations || {});
  } catch (error) {
    console.error('Error getting stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
};

// Import stations from JSON
export const importStations = async (req, res) => {
  try {
    const jsonPath = join(__dirname, '..', 'Main_database.json');
    const stationsData = JSON.parse(readFileSync(jsonPath, 'utf8'));
    
    const stationsRef = adminDb.ref('stations');
    await stationsRef.set(stationsData);
    
    res.json({ message: 'Stations imported successfully' });
  } catch (error) {
    console.error('Error importing stations:', error);
    res.status(500).json({ error: 'Failed to import stations' });
  }
};

// Update station
export const updateStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    const updateData = req.body;
    
    const stationRef = adminDb.ref(`stations/${stationId}`);
    await stationRef.update(updateData);
    
    res.json({ message: 'Station updated successfully' });
  } catch (error) {
    console.error('Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
};

// Delete station
export const deleteStation = async (req, res) => {
  try {
    const { stationId } = req.params;
    
    const stationRef = adminDb.ref(`stations/${stationId}`);
    await stationRef.remove();
    
    res.json({ message: 'Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting station:', error);
    res.status(500).json({ error: 'Failed to delete station' });
  }
}; 