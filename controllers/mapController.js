const { Client } = require('@googlemaps/google-maps-services-js');
const Location = require('../models/Location');

const googleMapsClient = new Client({});

// Get all campus locations
exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find();
    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

// Add a new location
exports.addLocation = async (req, res) => {
  try {
    const location = await Location.create(req.body);
    res.status(201).json({
      success: true,
      data: location,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Server Error',
    });
  }
};

// Get directions between two points
exports.getDirections = async (req, res) => {
  const { origin, destination, mode } = req.query;
  
  if (!origin || !destination) {
    return res.status(400).json({
      success: false,
      error: 'Please provide origin and destination',
    });
  }

  try {
    const response = await googleMapsClient.directions({
      params: {
        origin,
        destination,
        mode: mode || 'walking',
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error fetching directions',
      details: error.response ? error.response.data : error.message,
    });
  }
};

// Search for a place on campus
exports.searchPlace = async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a search query',
    });
  }

  try {
    // First search in our database
    const localResults = await Location.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { address: { $regex: query, $options: 'i' } },
      ],
    });

    // If we don't have enough results, search using Google Places API
    if (localResults.length < 5) {
      const response = await googleMapsClient.textSearch({
        params: {
          query: `${query} campus`,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });

      // Combine results
      const googleResults = response.data.results.map(place => ({
        name: place.name,
        description: place.vicinity,
        coordinates: {
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
        },
        address: place.formatted_address,
        type: 'facility',
        googlePlaceId: place.place_id,
      }));

      res.status(200).json({
        success: true,
        data: [...localResults, ...googleResults.slice(0, 10 - localResults.length)],
      });
    } else {
      res.status(200).json({
        success: true,
        data: localResults,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error searching for places',
      details: error.response ? error.response.data : error.message,
    });
  }
};