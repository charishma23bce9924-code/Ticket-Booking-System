const router = require('express').Router();
const { createVenue, listVenues, getVenue } = require('../controllers/venueController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.post('/', requireAuth, requireRole('ADMIN'), asyncHandler(createVenue));
router.get('/', asyncHandler(listVenues));
router.get('/:id', asyncHandler(getVenue));

module.exports = router;
