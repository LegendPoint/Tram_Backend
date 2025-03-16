const express = require('express');
const router = express.Router();
const {
  getLocations,
  addLocation,
  getDirections,
  searchPlace,
} = require('../controllers/mapController');

router.route('/locations')
  .get(getLocations)
  .post(addLocation);

router.get('/directions', getDirections);
router.get('/search', searchPlace);

module.exports = router;