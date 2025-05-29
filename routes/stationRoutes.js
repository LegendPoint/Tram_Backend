import express from 'express';
import { importStations, getAllStations, updateStation, deleteStation } from '../controllers/stationController.js';

const router = express.Router();

// Import stations from JSON to Firebase
router.post('/import', importStations);

// Get all stations
router.get('/', getAllStations);

// Update a station
router.put('/:stationId', updateStation);

// Delete a station
router.delete('/:stationId', deleteStation);

export default router; 